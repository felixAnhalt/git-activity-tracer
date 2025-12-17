import { Octokit } from '@octokit/rest';
import type { Dayjs } from 'dayjs';
import type {
  Contribution,
  ContributionType,
  GraphQLResponse,
  GraphQLErrorResponse,
} from '../types.js';

export type { Contribution, ContributionType } from '../types.js';

const QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      commitContributionsByRepository {
        repository { nameWithOwner }
        contributions(first: 100) {
          nodes {
            occurredAt
            url
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

export class GitHubConnector {
  private octokit: Octokit;

  /**
   * Constructor accepts either an Octokit instance or a token string.
   */
  constructor(octokitOrToken: Octokit | string) {
    if (typeof octokitOrToken === 'string') {
      if (!octokitOrToken) throw new Error('A non-empty GitHub token string is required.');
      this.octokit = new Octokit({ auth: octokitOrToken });
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

  async fetchContributions(from: Dayjs, to: Dayjs): Promise<Contribution[]> {
    const login = await this.getUserLogin();

    const variables = {
      login,
      from: from.toISOString(),
      to: to.toISOString(),
    };

    let coll;
    try {
      const res = await this.octokit.request('POST /graphql', { query: QUERY, variables });

      const maybeError = res.data as unknown as GraphQLErrorResponse;
      if (maybeError && Array.isArray(maybeError.errors) && maybeError.errors.length > 0) {
        throw new Error(
          `GraphQL API returned errors: ${maybeError.errors.map((e) => e.message).join(', ')}`,
        );
      }

      const data = (res.data as any)?.data as GraphQLResponse | undefined;
      if (!data?.user?.contributionsCollection) {
        throw new Error('No data returned from GitHub GraphQL API');
      }
      coll = data.user.contributionsCollection;
    } catch (err) {
      const e = new Error('Error fetching data from GitHub GraphQL API');
      (e as any).cause = err;
      throw e;
    }

    const contributions: Contribution[] = [];
    const pushContribution = (item: Contribution) => contributions.push(item);

    // commit contributions
    for (const repo of coll.commitContributionsByRepository ?? []) {
      for (const node of repo.contributions?.nodes ?? []) {
        if (node && typeof node.occurredAt === 'string') {
          pushContribution({ type: 'commit', timestamp: node.occurredAt, url: node.url });
        }
      }
    }

    // pull requests
    for (const pr of coll.pullRequestContributions?.nodes ?? []) {
      if (pr && typeof pr.occurredAt === 'string') {
        pushContribution({
          type: 'pr',
          timestamp: pr.occurredAt,
          text: pr.pullRequest?.title,
          url: pr.pullRequest?.url,
        });
      }
    }

    // reviews
    for (const rv of coll.pullRequestReviewContributions?.nodes ?? []) {
      if (rv && typeof rv.occurredAt === 'string') {
        pushContribution({
          type: 'review',
          timestamp: rv.occurredAt,
          text: 'review',
          url: rv.pullRequestReview?.url,
        });
      }
    }

    // Also fetch recent user events to capture direct pushes to base branches
    try {
      const eventsRes = await this.octokit.request('GET /users/{username}/events', {
        username: login,
        per_page: 100,
      });

      const eventsData = eventsRes.data as any;
      if (Array.isArray(eventsData)) {
        const baseRefs = new Set([
          'refs/heads/main',
          'refs/heads/master',
          'refs/heads/development',
          'refs/heads/develop',
        ]);
        for (const ev of eventsData as any[]) {
          if (!ev || ev.type !== 'PushEvent') continue;
          const createdAt = ev.created_at;
          const ref = ev?.payload?.ref;
          if (typeof createdAt !== 'string' || typeof ref !== 'string') continue;

          const createdTs = Date.parse(createdAt);
          const fromTs = Date.parse(variables.from);
          const toTs = Date.parse(variables.to);
          if (Number.isNaN(createdTs)) continue;
          if (createdTs < fromTs || createdTs > toTs) continue;
          if (!baseRefs.has(ref)) continue;

          const repoName = typeof ev.repo?.name === 'string' ? ev.repo.name : undefined;
          for (const commit of ev.payload?.commits ?? []) {
            const sha = commit?.sha;
            const message = commit?.message;
            const url =
              sha && repoName ? `https://github.com/${repoName}/commit/${sha}` : commit?.url;
            pushContribution({ type: 'commit', timestamp: createdAt, text: message, url });
          }
        }
      }
    } catch (err) {
      // Best-effort: ignore events fetch errors but do not crash the flow.
    }

    // Deduplicate results by type|timestamp|url|text
    const unique = new Map<string, Contribution>();
    for (const c of contributions) {
      const key = `${c.type}|${c.timestamp}|${c.url ?? ''}|${c.text ?? ''}`;
      if (!unique.has(key)) unique.set(key, c);
    }

    return Array.from(unique.values());
  }
}

export function createGitHubConnector(token?: string): GitHubConnector {
  if (!token) {
    throw new Error(
      'GH_TOKEN environment variable is missing. To create a GitHub token see README or https://github.com/settings/tokens',
    );
  }
  return new GitHubConnector(token);
}
