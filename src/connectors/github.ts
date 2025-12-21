import { Octokit } from '@octokit/rest';
import type { Dayjs } from 'dayjs';
import type { Contribution } from '../types.js';
import type { Configuration } from '../lib/config/index.js';
import type { Connector } from './types.js';
import { deduplicateContributions } from '../lib/services/contributionDeduplicator.js';
import type {
  GraphQLResponse,
  GraphQLErrorResponse,
  GraphQLApiResponse,
  DateRange,
  DateRangeTimestamps,
  GraphQLCommitRepoWithHistory,
  GraphQLPRNode,
  GraphQLReviewNode,
  GitHubEvent,
  GitHubEventPayload,
} from './github.types.js';

export type { Contribution, ContributionType } from '../types.js';

const QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      commitContributionsByRepository(maxRepositories: 50) {
        repository {
          nameWithOwner
          defaultBranchRef {
            name
            target {
              ... on Commit {
                history(first: 100) {
                  nodes {
                    oid
                    committedDate
                    messageHeadline
                    message
                    url
                    author {
                      name
                      email
                      user { login }
                    }
                  }
                  pageInfo {
                    hasNextPage
                    endCursor
                  }
                }
              }
            }
          }
        }
      }
      pullRequestContributions(first: 100) {
        nodes {
          occurredAt
          pullRequest {
            title
            url
            baseRefName
          }
        }
      }
      pullRequestReviewContributions(first: 100) {
        nodes {
          occurredAt
          pullRequestReview {
            url
            pullRequest {
              baseRefName
            }
          }
        }
      }
    }
  }
}`;

// Query for paginating commit history for a specific repository
const PAGINATED_COMMIT_QUERY = `
query($owner: String!, $name: String!, $branch: String!, $cursor: String, $from: GitTimestamp, $to: GitTimestamp) {
  repository(owner: $owner, name: $name) {
    ref(qualifiedName: $branch) {
      target {
        ... on Commit {
          history(first: 100, after: $cursor, since: $from, until: $to) {
            nodes {
              oid
              committedDate
              messageHeadline
              message
              url
              author {
                name
                email
                user { login }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    }
  }
}`;

const isGraphQLErrorResponse = (x: unknown): x is GraphQLErrorResponse => {
  return (
    !!x &&
    typeof x === 'object' &&
    'errors' in x &&
    Array.isArray((x as { errors?: unknown }).errors)
  );
};

const extractPayloadFromGraphQLResponse = (raw: unknown): GraphQLResponse | null => {
  // Octokit returns { data: { data: { ... } } } for GraphQL queries; handle both shapes
  if (!raw || typeof raw !== 'object') return null;
  const asAny = raw as { data?: unknown };
  const inner = asAny.data ?? raw;
  if (!inner || typeof inner !== 'object') return null;
  return inner as GraphQLResponse;
};

export class GitHubConnector implements Connector {
  private octokit: Octokit;
  private configuration: Configuration;

  /**
   * Constructor accepts either an Octokit instance or a token string, plus configuration.
   */
  constructor(octokitOrToken: Octokit | string, configuration: Configuration) {
    if (typeof octokitOrToken === 'string') {
      if (!octokitOrToken || octokitOrToken.trim() === '') {
        throw new Error('A non-empty GitHub token string is required.');
      }
      this.octokit = new Octokit({ auth: octokitOrToken });
    } else if (!octokitOrToken) {
      throw new Error('Octokit instance or token string is required.');
    } else {
      this.octokit = octokitOrToken;
    }
    this.configuration = configuration;
  }

  getPlatformName(): string {
    return 'GitHub';
  }

  async getUserLogin(): Promise<string> {
    const r = await this.octokit.rest.users.getAuthenticated();
    if (!r?.data?.login || typeof r.data.login !== 'string') {
      throw new Error('Unable to determine authenticated user login from GitHub.');
    }
    return r.data.login;
  }

  /**
   * Fetches contribution data from GitHub GraphQL API.
   * @throws {Error} If API returns errors or no data
   */
  private async fetchGraphQLContributions(
    login: string,
    dateRange: DateRange,
  ): Promise<NonNullable<GraphQLResponse['user']>['contributionsCollection']> {
    const variables = {
      login,
      from: dateRange.from,
      to: dateRange.to,
    };

    try {
      const response = await this.octokit.request('POST /graphql', {
        query: QUERY,
        variables,
      });

      const rawData = (response as GraphQLApiResponse).data;

      if (isGraphQLErrorResponse(rawData)) {
        const messages = (rawData.errors ?? []).map((error) => error.message).join(', ');
        throw new Error(`GraphQL API returned errors: ${messages}`);
      }

      const payload = extractPayloadFromGraphQLResponse(rawData);
      if (!payload?.user?.contributionsCollection) {
        throw new Error('No data returned from GitHub GraphQL API');
      }

      return payload.user.contributionsCollection;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error('Error fetching data from GitHub GraphQL API: ' + error.message);
      }
      throw new Error('Error fetching data from GitHub GraphQL API: ' + String(error));
    }
  }

  /**
   * Parses ISO date strings to timestamps for efficient range checking.
   * @throws {Error} If date strings are invalid
   */
  private parseDateRangeTimestamps(dateRange: DateRange): DateRangeTimestamps {
    const fromTimestamp = Date.parse(dateRange.from);
    const toTimestamp = Date.parse(dateRange.to);

    if (Number.isNaN(fromTimestamp) || Number.isNaN(toTimestamp)) {
      throw new Error('Invalid date range provided');
    }

    return { fromTimestamp, toTimestamp };
  }

  /**
   * Extracts repository name from GitHub URL.
   * @param url GitHub URL in format: https://github.com/owner/repository/...
   * @returns Repository name in format: owner/repository or undefined if unable to extract
   */
  private extractRepositoryFromUrl(url?: string): string | undefined {
    if (!url) return undefined;
    const match = url.match(/github\.com\/([^/?#]+\/[^/?#]+)/);
    return match?.[1];
  }

  /**
   * Fetches paginated commit history for a specific repository branch.
   * Continues fetching until all commits in the date range are retrieved.
   * Filters commits to only include those authored by the authenticated user.
   */
  private async fetchPaginatedCommits(
    owner: string,
    name: string,
    branch: string,
    dateRange: DateRange,
    initialCursor: string | undefined,
    userLogin: string,
  ): Promise<Contribution[]> {
    const contributions: Contribution[] = [];
    let cursor = initialCursor;
    const repositoryName = `${owner}/${name}`;

    let hasNextPage = true;
    while (hasNextPage) {
      try {
        const response = await this.octokit.request('POST /graphql', {
          query: PAGINATED_COMMIT_QUERY,
          variables: {
            owner,
            name,
            branch: `refs/heads/${branch}`,
            cursor,
            from: dateRange.from,
            to: dateRange.to,
          },
        });

        const rawData = (response as GraphQLApiResponse).data;

        if (isGraphQLErrorResponse(rawData)) {
          console.warn(`Warning: Failed to paginate commits for ${repositoryName}/${branch}`);
          break;
        }

        const data = rawData as {
          data?: {
            repository?: {
              ref?: {
                target?: {
                  history?: {
                    nodes?: Array<{
                      oid?: string;
                      committedDate?: string;
                      messageHeadline?: string;
                      message?: string;
                      url?: string;
                      author?: {
                        name?: string;
                        email?: string;
                        user?: {
                          login?: string;
                        };
                      };
                    }>;
                    pageInfo?: {
                      hasNextPage?: boolean;
                      endCursor?: string;
                    };
                  };
                };
              };
            };
          };
        };

        const history = data.data?.repository?.ref?.target?.history;
        if (!history?.nodes) break;

        for (const commit of history.nodes) {
          if (!commit?.committedDate) continue;

          // Filter commits by author: only include commits by the authenticated user
          // Skip commits where:
          // 1. Author has no linked GitHub account (authorLogin is undefined)
          // 2. Author is a different GitHub user
          const authorLogin = commit.author?.user?.login;
          if (!authorLogin || authorLogin !== userLogin) {
            continue;
          }

          contributions.push({
            type: 'commit',
            timestamp: commit.committedDate,
            text: commit.messageHeadline?.trim() || commit.message?.trim() || undefined,
            url: commit.url,
            repository: repositoryName,
            target: branch,
          });
        }

        hasNextPage = history.pageInfo?.hasNextPage ?? false;
        cursor = history.pageInfo?.endCursor;

        // Safety check: if no cursor, stop pagination
        if (hasNextPage && !cursor) break;
      } catch (error) {
        console.warn(
          `Warning: Error paginating commits for ${repositoryName}/${branch}: ${error instanceof Error ? error.message : String(error)}`,
        );
        break;
      }
    }

    return contributions;
  }

  /**
   * Extracts commit contributions from GraphQL response with parallelized pagination.
   * Processes multiple repositories in parallel for better performance.
   * Filters commits to only include those authored by the authenticated user.
   */
  private async extractCommitContributions(
    commitsByRepository: GraphQLCommitRepoWithHistory[],
    dateRangeTimestamps: DateRangeTimestamps,
    dateRange: DateRange,
    userLogin: string,
  ): Promise<Contribution[]> {
    // Process all repositories in parallel
    const repositoryPromises = commitsByRepository.map(async (repositoryWrapper) => {
      const repository = repositoryWrapper.repository;
      if (!repository) return [];

      const repositoryName = repository.nameWithOwner;
      const defaultBranchRef = repository.defaultBranchRef;

      // Handle repositories without a default branch (empty repositories)
      if (!defaultBranchRef?.target?.history) return [];

      const branchName = defaultBranchRef.name;
      const history = defaultBranchRef.target.history;
      const commitNodes = history.nodes ?? [];

      const contributions: Contribution[] = [];

      // Process initial batch of commits
      for (const commit of commitNodes) {
        if (!commit) continue;

        const timestamp = commit.committedDate;
        if (!timestamp || typeof timestamp !== 'string') continue;

        // Filter commits by date range
        const commitTimestamp = Date.parse(timestamp);
        if (Number.isNaN(commitTimestamp)) continue;

        if (
          commitTimestamp < dateRangeTimestamps.fromTimestamp ||
          commitTimestamp > dateRangeTimestamps.toTimestamp
        ) {
          continue;
        }

        // Filter commits by author: only include commits by the authenticated user
        const authorLogin = commit.author?.user?.login;
        if (!authorLogin || authorLogin !== userLogin) {
          continue;
        }

        contributions.push({
          type: 'commit',
          timestamp,
          text: commit.messageHeadline?.trim() || commit.message?.trim() || undefined,
          url: commit.url,
          repository: repositoryName,
          target: branchName,
        });
      }

      // If there are more pages, fetch them
      if (
        history.pageInfo?.hasNextPage &&
        history.pageInfo.endCursor &&
        repositoryName &&
        branchName
      ) {
        const [owner, name] = repositoryName.split('/');
        if (owner && name) {
          const paginatedCommits = await this.fetchPaginatedCommits(
            owner,
            name,
            branchName,
            dateRange,
            history.pageInfo.endCursor,
            userLogin,
          );

          // Filter paginated commits by date range
          for (const commit of paginatedCommits) {
            const commitTimestamp = Date.parse(commit.timestamp);
            if (
              !Number.isNaN(commitTimestamp) &&
              commitTimestamp >= dateRangeTimestamps.fromTimestamp &&
              commitTimestamp <= dateRangeTimestamps.toTimestamp
            ) {
              contributions.push(commit);
            }
          }
        }
      }

      return contributions;
    });

    const allResults = await Promise.all(repositoryPromises);
    return allResults.flat();
  }

  /**
   * Extracts pull request contributions from GraphQL response.
   */
  private extractPullRequestContributions(pullRequestNodes: GraphQLPRNode[]): Contribution[] {
    const contributions: Contribution[] = [];

    for (const pullRequest of pullRequestNodes) {
      if (pullRequest && typeof pullRequest.occurredAt === 'string') {
        contributions.push({
          type: 'pr',
          timestamp: pullRequest.occurredAt,
          text: pullRequest.pullRequest?.title,
          url: pullRequest.pullRequest?.url,
          repository: this.extractRepositoryFromUrl(pullRequest.pullRequest?.url),
          target: pullRequest.pullRequest?.baseRefName,
        });
      }
    }

    return contributions;
  }

  /**
   * Extracts pull request review contributions from GraphQL response.
   */
  private extractReviewContributions(reviewNodes: GraphQLReviewNode[]): Contribution[] {
    const contributions: Contribution[] = [];

    for (const review of reviewNodes) {
      if (review && typeof review.occurredAt === 'string') {
        contributions.push({
          type: 'review',
          timestamp: review.occurredAt,
          text: 'review',
          url: review.pullRequestReview?.url,
          repository: this.extractRepositoryFromUrl(review.pullRequestReview?.url),
          target: review.pullRequestReview?.pullRequest?.baseRefName,
        });
      }
    }

    return contributions;
  }

  /**
   * Deduplicates contributions by composite key: type|timestamp|url|text|repository|target.
   */
  private deduplicateContributions(contributions: Contribution[]): Contribution[] {
    return deduplicateContributions(contributions);
  }

  /**
   * Fetches all contributions for the authenticated user within the date range.
   * Uses GraphQL API to fetch commits (filtered by author), PRs, and reviews.
   * Optimized with timestamps and parallel extraction where possible.
   */
  async fetchContributions(from: Dayjs, to: Dayjs): Promise<Contribution[]> {
    const startTime = Date.now();
    const login = await this.getUserLogin();

    const dateRange: DateRange = {
      from: from.toISOString(),
      to: to.toISOString(),
    };

    console.log(`[${this.formatLogTimestamp()}] Fetching contributions from GitHub...`);

    const contributionsCollection = await this.fetchGraphQLContributions(login, dateRange);
    const dateRangeTimestamps = this.parseDateRangeTimestamps(dateRange);

    const allContributions: Contribution[] = [];

    if (contributionsCollection) {
      allContributions.push(
        ...(await this.extractCommitContributions(
          contributionsCollection.commitContributionsByRepository ?? [],
          dateRangeTimestamps,
          dateRange,
          login,
        )),
      );

      allContributions.push(
        ...this.extractPullRequestContributions(
          contributionsCollection.pullRequestContributions?.nodes ?? [],
        ),
      );

      allContributions.push(
        ...this.extractReviewContributions(
          contributionsCollection.pullRequestReviewContributions?.nodes ?? [],
        ),
      );
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `[${this.formatLogTimestamp()}] GitHub: found ${allContributions.length} contributions (took ${duration}s)`,
    );

    return this.deduplicateContributions(allContributions);
  }

  /**
   * Fetches events from GitHub Events API.
   * Tries both public and private endpoints to get complete event data.
   *
   * @param login - GitHub username
   * @returns Array of GitHub events
   */
  private async fetchEventsApiData(login: string): Promise<GitHubEvent[]> {
    try {
      // Try fetching from user-specific events endpoint (includes both public and authenticated user's private events)
      // This endpoint is better than /users/{username}/events as it includes private repo events
      const eventsResponse = await this.octokit.request('GET /users/{username}/events', {
        username: login,
        per_page: 100,
      });

      const rawData = eventsResponse.data;

      if (!Array.isArray(rawData)) {
        return [];
      }

      return rawData as GitHubEvent[];
    } catch (error) {
      // Log warnings for authentication or rate limit errors
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as { status: number }).status;
        if (status === 401) {
          console.warn('Warning: GitHub Events API authentication failed. Check your token.');
        } else if (status === 403) {
          console.warn('Warning: GitHub Events API rate limit exceeded or access forbidden.');
        } else {
          console.warn(
            `Warning: GitHub Events API returned status ${status}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } else {
        console.warn(
          `Warning: Error fetching from GitHub Events API: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return [];
    }
  }

  /**
   * Helper to format timestamp for logging.
   */
  private formatLogTimestamp(): string {
    return new Date().toISOString().substring(11, 23); // HH:mm:ss.SSS
  }

  /**
   * Fetches all commits from ALL branches using optimized 2-phase approach.
   * Unlike fetchContributions which filters by base branches,
   * this method returns all commits the user authored on any branch.
   *
   * Strategy:
   * Phase 1: Active branches - query commits from all current branches (parallelized)
   * Phase 2: Merged PRs - extract commits from merged pull requests (parallelized, captures deleted branches)
   *
   * Performance optimizations:
   * - Parallelized repository processing
   * - Parallelized branch queries within each repository
   * - Parallelized PR queries within each repository
   * - Removed redundant Events API phase
   *
   * This comprehensive approach:
   * - Finds commits on active feature branches
   * - Finds commits from deleted branches via merged PRs
   * - No 300 event limit
   * - Full pagination support
   *
   * @param from - Start date
   * @param to - End date
   * @returns Array of commit contributions from all branches
   */
  async fetchAllCommits(from: Dayjs, to: Dayjs): Promise<Contribution[]> {
    const startTime = Date.now();
    const login = await this.getUserLogin();
    const contributions: Contribution[] = [];

    const dateRange: DateRange = {
      from: from.toISOString(),
      to: to.toISOString(),
    };

    const dateRangeTimestamps = this.parseDateRangeTimestamps(dateRange);

    try {
      // Discover repositories
      console.log(`[${this.formatLogTimestamp()}] Discovering repositories...`);
      const contributionsCollection = await this.fetchGraphQLContributions(login, dateRange);

      if (contributionsCollection?.commitContributionsByRepository) {
        const repositories = contributionsCollection.commitContributionsByRepository
          .map((item) => item.repository?.nameWithOwner)
          .filter((name): name is string => !!name);

        console.log(
          `[${this.formatLogTimestamp()}] Found ${repositories.length} repositories to check`,
        );

        // Process all repositories in parallel
        const repositoryPromises = repositories.map(async (repositoryName) => {
          const [owner, repo] = repositoryName.split('/');
          if (!owner || !repo) return [];

          const repositoryContributions: Contribution[] = [];

          try {
            // PHASE 1: Fetch branches and commits in parallel
            console.log(`[${this.formatLogTimestamp()}] ${repositoryName}: fetching branches...`);
            const branchesPromise = this.octokit.paginate(this.octokit.rest.repos.listBranches, {
              owner,
              repo,
              per_page: 100,
            });

            // PHASE 2: Fetch merged PRs in parallel
            console.log(`[${this.formatLogTimestamp()}] ${repositoryName}: fetching merged PRs...`);
            const pullRequestsPromise = this.octokit.paginate(this.octokit.rest.pulls.list, {
              owner,
              repo,
              state: 'closed',
              sort: 'updated',
              direction: 'desc',
              per_page: 100,
            });

            // Wait for both branches and PRs
            const [branches, allPullRequests] = await Promise.all([
              branchesPromise,
              pullRequestsPromise,
            ]);

            console.log(
              `[${this.formatLogTimestamp()}] ${repositoryName}: processing ${branches.length} branches in parallel...`,
            );

            // Query commits from all branches in parallel
            const branchCommitPromises = branches.map(async (branch) => {
              try {
                const branchCommits = await this.octokit.paginate(
                  this.octokit.rest.repos.listCommits,
                  {
                    owner,
                    repo,
                    sha: branch.name,
                    author: login,
                    since: dateRange.from,
                    until: dateRange.to,
                    per_page: 100,
                  },
                );

                return branchCommits
                  .map((commit): Contribution | null => {
                    if (!commit.commit?.author?.date) return null;

                    const commitMessage = commit.commit.message || '';
                    const firstLine = commitMessage.split('\n')[0];

                    return {
                      type: 'commit',
                      timestamp: commit.commit.author.date,
                      text: firstLine,
                      url: commit.html_url,
                      repository: repositoryName,
                      target: branch.name,
                    };
                  })
                  .filter((item): item is Contribution => item !== null);
              } catch (branchError) {
                // Branch might be inaccessible, skip it
                return [];
              }
            });

            const branchResults = await Promise.all(branchCommitPromises);
            const branchContributions = branchResults.flat();

            repositoryContributions.push(...branchContributions);
            console.log(
              `[${this.formatLogTimestamp()}] ${repositoryName}: found ${branchContributions.length} commits from active branches`,
            );

            // Filter to only merged PRs by the authenticated user in date range
            const userMergedPRs = allPullRequests.filter((pullRequest) => {
              if (!pullRequest.merged_at) return false;
              if (pullRequest.user?.login !== login) return false;

              const mergedTimestamp = Date.parse(pullRequest.merged_at);

              return (
                mergedTimestamp >= dateRangeTimestamps.fromTimestamp &&
                mergedTimestamp <= dateRangeTimestamps.toTimestamp
              );
            });

            console.log(
              `[${this.formatLogTimestamp()}] ${repositoryName}: processing ${userMergedPRs.length} merged PRs in parallel...`,
            );

            // Process all PRs in parallel
            const pullRequestCommitPromises = userMergedPRs.map(async (pullRequest) => {
              try {
                const pullRequestCommits = await this.octokit.paginate(
                  this.octokit.rest.pulls.listCommits,
                  {
                    owner,
                    repo,
                    pull_number: pullRequest.number,
                    per_page: 100,
                  },
                );

                const headBranch = pullRequest.head?.ref;

                return pullRequestCommits
                  .map((commit): Contribution | null => {
                    if (!commit.commit?.author?.date) return null;

                    // Only include commits by the authenticated user
                    if (commit.author?.login !== login && commit.committer?.login !== login) {
                      return null;
                    }

                    // Check if commit is in date range
                    const commitTimestamp = Date.parse(commit.commit.author.date);

                    if (
                      commitTimestamp < dateRangeTimestamps.fromTimestamp ||
                      commitTimestamp > dateRangeTimestamps.toTimestamp
                    ) {
                      return null;
                    }

                    const commitMessage = commit.commit.message || '';
                    const firstLine = commitMessage.split('\n')[0];

                    return {
                      type: 'commit',
                      timestamp: commit.commit.author.date,
                      text: firstLine,
                      url: commit.html_url,
                      repository: repositoryName,
                      target: headBranch,
                    };
                  })
                  .filter((item): item is Contribution => item !== null);
              } catch (pullRequestError) {
                // PR might be inaccessible, skip it
                return [];
              }
            });

            const pullRequestResults = await Promise.all(pullRequestCommitPromises);
            const pullRequestContributions = pullRequestResults.flat();

            repositoryContributions.push(...pullRequestContributions);
            console.log(
              `[${this.formatLogTimestamp()}] ${repositoryName}: found ${pullRequestContributions.length} commits from merged PRs`,
            );
          } catch (error) {
            console.warn(
              `[${this.formatLogTimestamp()}] Warning: Failed to process ${repositoryName}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }

          return repositoryContributions;
        });

        // Wait for all repositories to complete
        const allRepositoryResults = await Promise.all(repositoryPromises);
        contributions.push(...allRepositoryResults.flat());
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(
        `[${this.formatLogTimestamp()}] Total commits collected: ${contributions.length} (took ${duration}s)`,
      );
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as { status: number }).status;
        if (status === 401) {
          console.warn(
            `[${this.formatLogTimestamp()}] Warning: GitHub API authentication failed. Check your token.`,
          );
        } else if (status === 403) {
          console.warn(
            `[${this.formatLogTimestamp()}] Warning: GitHub API rate limit exceeded or access forbidden.`,
          );
        } else {
          console.warn(
            `[${this.formatLogTimestamp()}] Warning: Error fetching commits from GitHub API: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } else {
        console.warn(
          `[${this.formatLogTimestamp()}] Warning: Error fetching commits from GitHub API: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return this.deduplicateContributions(contributions);
  }
}

export const createGitHubConnector = (
  token?: string,
  configuration?: Configuration,
): GitHubConnector => {
  if (token === undefined || token === null) {
    throw new Error(
      'GH_TOKEN environment variable is missing. To create a GitHub token see README or https://github.com/settings/tokens',
    );
  }
  if (token.trim() === '') {
    throw new Error('A non-empty GitHub token string is required.');
  }

  // Use provided configuration or defaults
  const finalConfiguration: Configuration = configuration ?? {
    baseBranches: ['main', 'master', 'develop', 'development'],
  };

  return new GitHubConnector(token, finalConfiguration);
};
