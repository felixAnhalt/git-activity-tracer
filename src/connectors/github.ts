import { Octokit } from '@octokit/rest';
import type { Dayjs } from 'dayjs';
import type {
  Contribution,
  GraphQLResponse,
  GraphQLErrorResponse,
  GitHubEvent,
  GraphQLApiResponse,
  EventsApiResponse,
  DateRange,
  DateRangeTimestamps,
  GraphQLCommitRepoWithHistory,
  GraphQLPRNode,
  GraphQLReviewNode,
} from '../types.js';

export type { Contribution, ContributionType } from '../types.js';

const QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      commitContributionsByRepository(maxRepositories: 50) {
        repository {
          nameWithOwner
          defaultBranchRef {
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
                }
              }
            }
          }
        }
      }
      pullRequestContributions(first: 100) {
        nodes {
          occurredAt
          pullRequest { title url }
        }
      }
      pullRequestReviewContributions(first: 100) {
        nodes {
          occurredAt
          pullRequestReview { url }
        }
      }
    }
  }
}`;

function isGraphQLErrorResponse(x: unknown): x is GraphQLErrorResponse {
  return (
    !!x &&
    typeof x === 'object' &&
    'errors' in x &&
    Array.isArray((x as { errors?: unknown }).errors)
  );
}

function extractPayloadFromGraphQLResponse(raw: unknown): GraphQLResponse | null {
  // Octokit returns { data: { data: { ... } } } for GraphQL queries; handle both shapes
  if (!raw || typeof raw !== 'object') return null;
  const asAny = raw as { data?: unknown };
  const inner = asAny.data ?? raw;
  if (!inner || typeof inner !== 'object') return null;
  return inner as GraphQLResponse;
}

export class GitHubConnector {
  private octokit: Octokit;

  /**
   * Constructor accepts either an Octokit instance or a token string.
   */
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
        throw new Error('Error fetching data from GitHub GraphQL API: ' + error.message, {
          cause: error,
        });
      }
      throw new Error('Error fetching data from GitHub GraphQL API: ' + String(error));
    }
  }

  /**
   * Fetches recent user events from GitHub Events API.
   * Returns empty array on error (best-effort).
   */
  private async fetchEventsApiData(login: string): Promise<GitHubEvent[]> {
    try {
      const eventsResponse = await this.octokit.request('GET /users/{username}/events', {
        username: login,
        per_page: 100,
      });

      const rawData = (eventsResponse as EventsApiResponse).data;

      if (!Array.isArray(rawData)) {
        return [];
      }

      return rawData as GitHubEvent[];
    } catch (error) {
      return [];
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
   * Extracts commit contributions from GraphQL response.
   */
  private extractCommitContributions(
    commitsByRepository: GraphQLCommitRepoWithHistory[],
    dateRangeTimestamps: DateRangeTimestamps,
  ): Contribution[] {
    const contributions: Contribution[] = [];

    for (const repositoryWrapper of commitsByRepository) {
      const repository = repositoryWrapper.repository;
      if (!repository) continue;

      const defaultBranchRef = repository.defaultBranchRef;

      // Handle repositories without a default branch (empty repositories)
      if (!defaultBranchRef?.target?.history?.nodes) continue;

      const commitNodes = defaultBranchRef.target.history.nodes;

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

        contributions.push({
          type: 'commit',
          timestamp,
          text: commit.messageHeadline?.trim() || commit.message?.trim() || undefined,
          url: commit.url,
        });
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
        });
      }
    }

    return contributions;
  }

  /**
   * Extracts commit contributions from push events to base branches.
   * Filters by date range and base branch references.
   */
  private extractPushEventContributions(
    events: GitHubEvent[],
    dateRangeTimestamps: DateRangeTimestamps,
  ): Contribution[] {
    const contributions: Contribution[] = [];

    const baseBranchReferences = new Set([
      'refs/heads/main',
      'refs/heads/master',
      'refs/heads/development',
      'refs/heads/develop',
    ]);

    for (const event of events) {
      if (!event || typeof event !== 'object') continue;
      if (event.type !== 'PushEvent') continue;

      const createdAt = event.created_at;
      const reference = event.payload?.ref;

      if (typeof createdAt !== 'string' || typeof reference !== 'string') continue;

      const createdTimestamp = Date.parse(createdAt);
      if (Number.isNaN(createdTimestamp)) continue;

      if (
        createdTimestamp < dateRangeTimestamps.fromTimestamp ||
        createdTimestamp > dateRangeTimestamps.toTimestamp
      ) {
        continue;
      }

      if (!baseBranchReferences.has(reference)) continue;

      const repositoryName = event.repo?.name;
      const commits = event.payload?.commits;

      if (!Array.isArray(commits)) continue;

      for (const commit of commits) {
        if (!commit || typeof commit !== 'object') continue;

        const sha = commit.sha;
        const message = commit.message;
        const url =
          sha && repositoryName ? `https://github.com/${repositoryName}/commit/${sha}` : commit.url;

        contributions.push({
          type: 'commit',
          timestamp: createdAt,
          text: message,
          url,
        });
      }
    }

    return contributions;
  }

  /**
   * Deduplicates contributions by composite key: type|timestamp|url|text.
   */
  private deduplicateContributions(contributions: Contribution[]): Contribution[] {
    const uniqueContributions = new Map<string, Contribution>();

    for (const contribution of contributions) {
      const key = `${contribution.type}|${contribution.timestamp}|${contribution.url ?? ''}|${contribution.text ?? ''}`;
      if (!uniqueContributions.has(key)) {
        uniqueContributions.set(key, contribution);
      }
    }

    return Array.from(uniqueContributions.values());
  }

  /**
   * Fetches all contributions for the authenticated user within the date range.
   * Combines GraphQL API (commits, PRs, reviews) and Events API (direct pushes).
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
        ...this.extractCommitContributions(
          contributionsCollection.commitContributionsByRepository ?? [],
          dateRangeTimestamps,
        ),
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

    const events = await this.fetchEventsApiData(login);

    allContributions.push(...this.extractPushEventContributions(events, dateRangeTimestamps));

    return this.deduplicateContributions(allContributions);
  }
}

export function createGitHubConnector(token?: string): GitHubConnector {
  if (token === undefined || token === null) {
    throw new Error(
      'GH_TOKEN environment variable is missing. To create a GitHub token see README or https://github.com/settings/tokens',
    );
  }
  if (token.trim() === '') {
    throw new Error('A non-empty GitHub token string is required.');
  }
  return new GitHubConnector(token);
}
