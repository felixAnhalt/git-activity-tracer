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
   * Extracts commit contributions from GraphQL response.
   * Now supports pagination for repositories with more than 100 commits.
   * Filters commits to only include those authored by the authenticated user.
   */
  private async extractCommitContributions(
    commitsByRepository: GraphQLCommitRepoWithHistory[],
    dateRangeTimestamps: DateRangeTimestamps,
    dateRange: DateRange,
    userLogin: string,
  ): Promise<Contribution[]> {
    const contributions: Contribution[] = [];

    for (const repositoryWrapper of commitsByRepository) {
      const repository = repositoryWrapper.repository;
      if (!repository) continue;

      const repositoryName = repository.nameWithOwner;
      const defaultBranchRef = repository.defaultBranchRef;

      // Handle repositories without a default branch (empty repositories)
      if (!defaultBranchRef?.target?.history) continue;

      const branchName = defaultBranchRef.name;
      const history = defaultBranchRef.target.history;
      const commitNodes = history.nodes ?? [];

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
        // Skip commits where:
        // 1. Author has no linked GitHub account (authorLogin is undefined)
        // 2. Author is a different GitHub user
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
    }

    return contributions;
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
   * Events API is not used for commits as it includes all commits in a push,
   * not just those authored by the user.
   */
  async fetchContributions(from: Dayjs, to: Dayjs): Promise<Contribution[]> {
    const login = await this.getUserLogin();

    const dateRange: DateRange = {
      from: from.toISOString(),
      to: to.toISOString(),
    };

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

    // Note: Events API is not used for commit contributions because PushEvents
    // include all commits in the push, not just those authored by the user.
    // The GraphQL API already provides accurate commit authorship information.

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
   * Fetches all commits from ALL branches using GitHub Events API.
   * Unlike fetchContributions which filters by base branches and authorship,
   * this method returns all commits the user pushed to any branch.
   *
   * Performance optimizations:
   * - Early filtering of non-PushEvents before processing
   * - Aggressive pagination termination when past date range
   * - Parallel batch fetching of commit details via compareCommits
   *
   * Limitations of GitHub Events API:
   * - Maximum 300 events per user
   * - Events older than 90 days are not available
   * - Commit details may be empty for some push events
   *
   * @param from - Start date
   * @param to - End date
   * @returns Array of commit contributions from all branches
   */
  async fetchAllCommits(from: Dayjs, to: Dayjs): Promise<Contribution[]> {
    const login = await this.getUserLogin();
    const contributions: Contribution[] = [];

    const fromTimestamp = from.valueOf();
    const toTimestamp = to.valueOf();

    try {
      // Fetch events using pagination to get up to 300 events
      // Apply early filtering during pagination to reduce unnecessary data transfer
      const events = await this.octokit.paginate(
        'GET /users/{username}/events',
        {
          username: login,
          per_page: 100,
        },
        (response, done) => {
          // Early termination: stop if we've gone past the date range
          const lastEvent = response.data[response.data.length - 1];
          if (lastEvent && lastEvent.created_at) {
            const lastEventTime = new Date(lastEvent.created_at).getTime();
            if (lastEventTime < fromTimestamp) {
              done();
            }
          }

          // Early filtering: only return PushEvents to reduce memory usage
          return response.data.filter(
            (event) => event.type === 'PushEvent' && event.created_at,
          ) as GitHubEvent[];
        },
      );

      // Filter events by date range early (before processing)
      const pushEventsInRange = events.filter((event) => {
        if (!event.created_at) return false;
        const eventTimestamp = new Date(event.created_at).getTime();
        return eventTimestamp >= fromTimestamp && eventTimestamp <= toTimestamp;
      });

      // Separate events into two groups:
      // 1. Events that already have commit data (rare)
      // 2. Events that need commit data fetched via API (common)
      const eventsWithCommits: GitHubEvent[] = [];
      const eventsNeedingFetch: Array<{
        event: GitHubEvent;
        owner: string;
        repo: string;
        before: string;
        head: string;
        repository: string;
        branchName: string | undefined;
      }> = [];

      for (const event of pushEventsInRange) {
        const payload = event.payload as GitHubEventPayload;
        const repository = event.repo?.name;
        const ref = payload?.ref;
        const branchName = ref?.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref;

        // Check if commits array exists and has data (rare in Events API)
        if (payload?.commits && Array.isArray(payload.commits) && payload.commits.length > 0) {
          eventsWithCommits.push(event);
        } else if (payload?.head && payload?.before && repository) {
          const [owner, repo] = repository.split('/');
          if (owner && repo) {
            eventsNeedingFetch.push({
              event,
              owner,
              repo,
              before: payload.before,
              head: payload.head,
              repository,
              branchName,
            });
          }
        } else {
          // Missing required payload data, create fallback entry immediately
          contributions.push({
            type: 'commit',
            timestamp: event.created_at!,
            text: `Push to ${branchName || 'unknown branch'}`,
            repository,
            target: branchName,
          });
        }
      }

      // Process events that already have commit data (fast path)
      for (const event of eventsWithCommits) {
        const payload = event.payload as GitHubEventPayload;
        const repository = event.repo?.name;
        const ref = payload?.ref;
        const branchName = ref?.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref;

        for (const commit of payload.commits!) {
          if (!commit.message) continue;

          contributions.push({
            type: 'commit',
            timestamp: event.created_at!,
            text: commit.message.split('\n')[0], // First line of commit message
            url: commit.url,
            repository,
            target: branchName,
          });
        }
      }

      // Batch fetch commit details for all events in parallel (major performance improvement)
      if (eventsNeedingFetch.length > 0) {
        const comparisonPromises = eventsNeedingFetch.map(async (eventInfo) => {
          try {
            const comparison = await this.octokit.rest.repos.compareCommits({
              owner: eventInfo.owner,
              repo: eventInfo.repo,
              base: eventInfo.before,
              head: eventInfo.head,
            });

            return {
              success: true as const,
              eventInfo,
              comparison: comparison.data,
            };
          } catch (error) {
            return {
              success: false as const,
              eventInfo,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        });

        // Execute all comparison requests in parallel
        const results = await Promise.all(comparisonPromises);

        // Process results
        for (const result of results) {
          const { eventInfo } = result;
          const { event, repository, branchName } = eventInfo;

          if (result.success) {
            // Extract commits from comparison and filter by authenticated user
            const { comparison } = result;
            if (comparison.commits && comparison.commits.length > 0) {
              for (const commit of comparison.commits) {
                // Only include commits authored by the authenticated user
                if (commit.author?.login === login || commit.committer?.login === login) {
                  contributions.push({
                    type: 'commit',
                    timestamp: event.created_at!,
                    text: commit.commit.message.split('\n')[0], // First line of commit message
                    url: commit.html_url,
                    repository,
                    target: branchName,
                  });
                }
              }
            } else {
              // No commits in comparison, create fallback entry
              contributions.push({
                type: 'commit',
                timestamp: event.created_at!,
                text: `Push to ${branchName}`,
                repository,
                target: branchName,
              });
            }
          } else {
            // If fetching commits failed (e.g., commits deleted, force push), create fallback entry
            console.warn(
              `Warning: Could not fetch commits for ${repository} ${branchName}: ${result.error}`,
            );
            contributions.push({
              type: 'commit',
              timestamp: event.created_at!,
              text: `Push to ${branchName}`,
              repository,
              target: branchName,
            });
          }
        }
      }
    } catch (error) {
      // Log specific warnings for authentication or rate limit errors
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as { status: number }).status;
        if (status === 401) {
          console.warn('Warning: GitHub Events API authentication failed. Check your token.');
        } else if (status === 403) {
          console.warn('Warning: GitHub Events API rate limit exceeded or access forbidden.');
        } else {
          console.warn(
            `Warning: Error fetching commits from GitHub Events API: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } else {
        console.warn(
          `Warning: Error fetching commits from GitHub Events API: ${error instanceof Error ? error.message : String(error)}`,
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
