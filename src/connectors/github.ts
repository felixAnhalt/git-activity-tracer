import { Octokit } from '@octokit/rest';
import type { Dayjs } from 'dayjs';
import type {
  Contribution,
  ContributionType,
  GraphQLResponse,
  GraphQLErrorResponse,
} from './types.js';

export type { Contribution, ContributionType } from './types.js';

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

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async getUserLogin(): Promise<string> {
    const r = await this.octokit.rest.users.getAuthenticated();
    return r.data.login;
  }

  async fetchContributions(from: Dayjs, to: Dayjs): Promise<Contribution[]> {
    const login = await this.getUserLogin();
    console.log('Authenticated as:', login);

    const variables = {
      login,
      from: from.toISOString(),
      to: to.toISOString(),
    };

    let coll;
    try {
      const res = await this.octokit.request('POST /graphql', { query: QUERY, variables });

      // Check for GraphQL errors
      const errorData = res.data as GraphQLErrorResponse;
      if (errorData.errors && errorData.errors.length > 0) {
        console.error('GraphQL errors:', JSON.stringify(errorData.errors, null, 2));
        throw new Error(
          `GraphQL API returned errors: ${errorData.errors.map((e) => e.message).join(', ')}`,
        );
      }

      // octokit returns the GraphQL payload at res.data.data
      const data = res.data.data as GraphQLResponse | undefined;
      console.log(`Fetched data from ${from.format('YYYY-MM-DD')} to ${to.format('YYYY-MM-DD')}`);

      if (!data?.user?.contributionsCollection) {
        throw new Error('No data returned from GitHub GraphQL API');
      }
      coll = data.user.contributionsCollection;
    } catch (err) {
      if (err instanceof Error) {
        throw new Error(`Error fetching data from GitHub GraphQL API: ${err.message}`);
      }
      throw err;
    }

    const contributions: Contribution[] = [];

    // commit contributions
    for (const r of coll.commitContributionsByRepository ?? []) {
      for (const c of r.contributions?.nodes ?? []) {
        if (c && c.occurredAt) {
          contributions.push({ type: 'commit', timestamp: c.occurredAt, url: c.url });
        }
      }
    }

    // pull requests
    for (const pr of coll.pullRequestContributions?.nodes ?? []) {
      if (pr && pr.occurredAt) {
        contributions.push({
          type: 'pr',
          timestamp: pr.occurredAt,
          text: pr.pullRequest?.title,
          url: pr.pullRequest?.url,
        });
      }
    }

    // reviews
    for (const rv of coll.pullRequestReviewContributions?.nodes ?? []) {
      if (rv && rv.occurredAt) {
        contributions.push({
          type: 'review',
          timestamp: rv.occurredAt,
          text: 'review',
          url: rv.pullRequestReview?.url,
        });
      }
    }

    return contributions;
  }
}

export function createGitHubConnector(token?: string): GitHubConnector {
  if (!token) {
    console.error('GH_TOKEN environment variable is missing.');
    console.error('To create a GitHub personal access token:');
    console.error('  1. Go to https://github.com/settings/tokens');
    console.error('  2. Click "Generate new token (classic)"');
    console.error('  3. Select scopes: repo, read:user');
    console.error('  4. Export the token: export GH_TOKEN=your_token_here');
    process.exit(1);
  }
  return new GitHubConnector(token);
}
