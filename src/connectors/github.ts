import { Octokit } from '@octokit/rest';
import type { Dayjs } from 'dayjs';
import type { Contribution } from '../types.js';
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
  if (!raw || typeof raw !== 'object') return null;
  const asAny = raw as { data?: unknown };
  const inner = asAny.data ?? raw;
  if (!inner || typeof inner !== 'object') return null;
  return inner as GraphQLResponse;
};

/**
 * GitHub connector for fetching contributions via GitHub GraphQL and REST APIs.
 *
 * Note: This connector does NOT use the baseBranches configuration.
 * GitHub's GraphQL contributionsCollection API automatically provides commits
 * from the default branch, and fetchAllCommits() intentionally fetches from
 * all branches without filtering.
 */
export class GitHubConnector implements Connector {
  private octokit: Octokit;

  constructor(octokitOrToken: Octokit | string) {
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

  private parseDateRangeTimestamps(dateRange: DateRange): DateRangeTimestamps {
    const fromTimestamp = Date.parse(dateRange.from);
    const toTimestamp = Date.parse(dateRange.to);

    if (Number.isNaN(fromTimestamp) || Number.isNaN(toTimestamp)) {
      throw new Error('Invalid date range provided');
    }

    return { fromTimestamp, toTimestamp };
  }

  private extractRepositoryFromUrl(url?: string): string | undefined {
    if (!url) return undefined;
    const match = url.match(/github\.com\/([^/?#]+\/[^/?#]+)/);
    return match?.[1];
  }

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

  private async extractCommitContributions(
    commitsByRepository: GraphQLCommitRepoWithHistory[],
    dateRangeTimestamps: DateRangeTimestamps,
    dateRange: DateRange,
    userLogin: string,
  ): Promise<Contribution[]> {
    const repositoryPromises = commitsByRepository.map(async (repositoryWrapper) => {
      const repository = repositoryWrapper.repository;
      if (!repository) return [];

      const repositoryName = repository.nameWithOwner;
      const defaultBranchRef = repository.defaultBranchRef;

      if (!defaultBranchRef?.target?.history) return [];

      const branchName = defaultBranchRef.name;
      const history = defaultBranchRef.target.history;
      const commitNodes = history.nodes ?? [];

      const contributions: Contribution[] = [];

      for (const commit of commitNodes) {
        if (!commit) continue;

        const timestamp = commit.committedDate;
        if (!timestamp) continue;

        const commitTimestamp = Date.parse(timestamp);
        if (Number.isNaN(commitTimestamp)) continue;

        if (
          commitTimestamp < dateRangeTimestamps.fromTimestamp ||
          commitTimestamp > dateRangeTimestamps.toTimestamp
        ) {
          continue;
        }

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

  private deduplicateContributions(contributions: Contribution[]): Contribution[] {
    return deduplicateContributions(contributions);
  }

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

  private formatLogTimestamp(): string {
    return new Date().toISOString().substring(11, 23); // HH:mm:ss.SSS
  }

  private async fetchBranchCommits(
    owner: string,
    repository: string,
    branchName: string,
    login: string,
    dateRange: DateRange,
    repositoryName: string,
  ): Promise<Contribution[]> {
    try {
      const branchCommits = await this.octokit.paginate(this.octokit.rest.repos.listCommits, {
        owner,
        repo: repository,
        sha: branchName,
        author: login,
        since: dateRange.from,
        until: dateRange.to,
        per_page: 100,
      });

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
            target: branchName,
          };
        })
        .filter((item): item is Contribution => item !== null);
    } catch (branchError) {
      return [];
    }
  }

  private async fetchCommitsFromAllBranches(
    owner: string,
    repository: string,
    branches: Array<{ name: string }>,
    login: string,
    dateRange: DateRange,
    repositoryName: string,
  ): Promise<Contribution[]> {
    console.log(
      `[${this.formatLogTimestamp()}] ${repositoryName}: processing ${branches.length} branches in parallel...`,
    );

    const branchCommitPromises = branches.map((branch) =>
      this.fetchBranchCommits(owner, repository, branch.name, login, dateRange, repositoryName),
    );

    const branchResults = await Promise.all(branchCommitPromises);
    const branchContributions = branchResults.flat();

    console.log(
      `[${this.formatLogTimestamp()}] ${repositoryName}: found ${branchContributions.length} commits from active branches`,
    );

    return branchContributions;
  }

  private async fetchPullRequestCommits(
    owner: string,
    repository: string,
    pullRequest: { number: number; head?: { ref?: string } },
    login: string,
    dateRangeTimestamps: DateRangeTimestamps,
    repositoryName: string,
  ): Promise<Contribution[]> {
    try {
      const pullRequestCommits = await this.octokit.paginate(this.octokit.rest.pulls.listCommits, {
        owner,
        repo: repository,
        pull_number: pullRequest.number,
        per_page: 100,
      });

      const headBranch = pullRequest.head?.ref;

      return pullRequestCommits
        .map((commit): Contribution | null => {
          if (!commit.commit?.author?.date) return null;

          if (commit.author?.login !== login && commit.committer?.login !== login) {
            return null;
          }

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
      return [];
    }
  }

  private filterUserMergedPullRequests<
    T extends {
      merged_at?: string | null;
      user?: { login?: string } | null;
    },
  >(pullRequests: T[], login: string, dateRangeTimestamps: DateRangeTimestamps): T[] {
    return pullRequests.filter((pullRequest) => {
      if (!pullRequest.merged_at) return false;
      if (pullRequest.user?.login !== login) return false;

      const mergedTimestamp = Date.parse(pullRequest.merged_at);

      return (
        mergedTimestamp >= dateRangeTimestamps.fromTimestamp &&
        mergedTimestamp <= dateRangeTimestamps.toTimestamp
      );
    });
  }

  private async fetchCommitsFromMergedPullRequests(
    owner: string,
    repository: string,
    pullRequests: Array<{
      merged_at?: string | null;
      user?: { login?: string } | null;
      number: number;
      head?: { ref?: string };
    }>,
    login: string,
    dateRangeTimestamps: DateRangeTimestamps,
    repositoryName: string,
  ): Promise<Contribution[]> {
    const userMergedPRs = this.filterUserMergedPullRequests(
      pullRequests,
      login,
      dateRangeTimestamps,
    );

    console.log(
      `[${this.formatLogTimestamp()}] ${repositoryName}: processing ${userMergedPRs.length} merged PRs in parallel...`,
    );

    const pullRequestCommitPromises = userMergedPRs.map((pullRequest) =>
      this.fetchPullRequestCommits(
        owner,
        repository,
        pullRequest,
        login,
        dateRangeTimestamps,
        repositoryName,
      ),
    );

    const pullRequestResults = await Promise.all(pullRequestCommitPromises);
    const pullRequestContributions = pullRequestResults.flat();

    console.log(
      `[${this.formatLogTimestamp()}] ${repositoryName}: found ${pullRequestContributions.length} commits from merged PRs`,
    );

    return pullRequestContributions;
  }

  private async fetchRepositoryCommits(
    owner: string,
    repository: string,
    repositoryName: string,
    login: string,
    dateRange: DateRange,
    dateRangeTimestamps: DateRangeTimestamps,
  ): Promise<Contribution[]> {
    const repositoryContributions: Contribution[] = [];

    try {
      console.log(`[${this.formatLogTimestamp()}] ${repositoryName}: fetching branches...`);
      const branchesPromise = this.octokit.paginate(this.octokit.rest.repos.listBranches, {
        owner,
        repo: repository,
        per_page: 100,
      });

      console.log(`[${this.formatLogTimestamp()}] ${repositoryName}: fetching merged PRs...`);
      const pullRequestsPromise = this.octokit.paginate(this.octokit.rest.pulls.list, {
        owner,
        repo: repository,
        state: 'closed',
        sort: 'updated',
        direction: 'desc',
        per_page: 100,
      });

      const [branches, allPullRequests] = await Promise.all([branchesPromise, pullRequestsPromise]);

      const branchContributions = await this.fetchCommitsFromAllBranches(
        owner,
        repository,
        branches,
        login,
        dateRange,
        repositoryName,
      );
      repositoryContributions.push(...branchContributions);

      const pullRequestContributions = await this.fetchCommitsFromMergedPullRequests(
        owner,
        repository,
        allPullRequests,
        login,
        dateRangeTimestamps,
        repositoryName,
      );
      repositoryContributions.push(...pullRequestContributions);
    } catch (error) {
      console.warn(
        `[${this.formatLogTimestamp()}] Warning: Failed to process ${repositoryName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return repositoryContributions;
  }

  private async discoverRepositories(login: string, dateRange: DateRange): Promise<string[]> {
    console.log(`[${this.formatLogTimestamp()}] Discovering repositories...`);
    const contributionsCollection = await this.fetchGraphQLContributions(login, dateRange);

    if (!contributionsCollection?.commitContributionsByRepository) {
      return [];
    }

    const repositories = contributionsCollection.commitContributionsByRepository
      .map((item) => item.repository?.nameWithOwner)
      .filter((name): name is string => !!name);

    console.log(
      `[${this.formatLogTimestamp()}] Found ${repositories.length} repositories to check`,
    );

    return repositories;
  }

  async fetchAllCommits(from: Dayjs, to: Dayjs): Promise<Contribution[]> {
    const startTime = Date.now();
    const login = await this.getUserLogin();

    const dateRange: DateRange = {
      from: from.toISOString(),
      to: to.toISOString(),
    };

    const dateRangeTimestamps = this.parseDateRangeTimestamps(dateRange);

    try {
      const repositories = await this.discoverRepositories(login, dateRange);

      const repositoryPromises = repositories.map(async (repositoryName) => {
        const [owner, repo] = repositoryName.split('/');
        if (!owner || !repo) return [];

        return this.fetchRepositoryCommits(
          owner,
          repo,
          repositoryName,
          login,
          dateRange,
          dateRangeTimestamps,
        );
      });

      const allRepositoryResults = await Promise.all(repositoryPromises);
      const contributions = allRepositoryResults.flat();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(
        `[${this.formatLogTimestamp()}] Total commits collected: ${contributions.length} (took ${duration}s)`,
      );

      return this.deduplicateContributions(contributions);
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

      return this.deduplicateContributions([]);
    }
  }
}

/**
 * Factory function to create a GitHub connector instance.
 *
 * @param token - GitHub personal access token
 * @returns GitHubConnector instance
 * @throws Error if token is missing or empty
 */
export const createGitHubConnector = (token?: string): GitHubConnector => {
  if (token === undefined || token === null) {
    throw new Error(
      'GH_TOKEN environment variable is missing. To create a GitHub token see README or https://github.com/settings/tokens',
    );
  }
  if (token.trim() === '') {
    throw new Error('A non-empty GitHub token string is required.');
  }

  return new GitHubConnector(token);
};
