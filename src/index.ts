#!/usr/bin/env ts-node

import { Octokit } from '@octokit/rest';
import yargs from 'yargs';
import dayjs from 'dayjs';
import { parseRange } from './utils.js';

type Item = { type: string; timestamp: string; text?: string; url?: string };

type GraphQLCommitNode = { occurredAt?: string; url?: string };
type GraphQLCommitRepo = {
  repository?: { nameWithOwner?: string };
  contributions?: { nodes?: GraphQLCommitNode[] };
};

type GraphQLPRNode = { occurredAt?: string; pullRequest?: { title?: string; url?: string } };

type GraphQLReviewNode = { occurredAt?: string; pullRequestReview?: { url?: string } };

type GraphQLResponse = {
  user?: {
    contributionsCollection?: {
      commitContributionsByRepository?: GraphQLCommitRepo[];
      pullRequestContributions?: { nodes?: GraphQLPRNode[] };
      pullRequestReviewContributions?: { nodes?: GraphQLReviewNode[] };
    };
  };
};

const argv = yargs(process.argv.slice(2))
  .option('from', { type: 'string' })
  .option('to', { type: 'string' })
  .option('with-links', { type: 'boolean', default: false })
  .parseSync();

const token = process.env.GH_TOKEN;
if (!token) {
  console.error('GH_TOKEN missing');
  process.exit(1);
}

const octokit = new Octokit({ auth: token });

async function getUserLogin() {
  const r = await octokit.rest.users.getAuthenticated();
  console.log('Authenticated as:', r.data.login);
  return r.data.login;
}

const query = `
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

async function main() {
  const login = await getUserLogin();
  const { from, to } = parseRange(argv.from as string | undefined, argv.to as string | undefined);

  // GraphQL expects ISO strings
  const variables = {
    login,
    from: from.toISOString(),
    to: to.toISOString(),
  };

  let coll;
  try {
    const res = await octokit.request('POST /graphql', { query, variables });
    // octokit returns the GraphQL payload at res.data.data
    const data = res.data.data as GraphQLResponse | undefined;
    console.log(`Fetched data from ${from.format('YYYY-MM-DD')} to ${to.format('YYYY-MM-DD')}`);
    if (!data?.user?.contributionsCollection) {
      console.error('No data returned from GitHub GraphQL API');
      process.exit(1);
    }
    coll = data.user.contributionsCollection;
  } catch (err) {
    console.error('Error fetching data from GitHub GraphQL API:', err);
    process.exit(1);
  }

  const items: Item[] = [];

  // commit contributions
  for (const r of coll.commitContributionsByRepository ?? []) {
    for (const c of r.contributions?.nodes ?? []) {
      if (c && c.occurredAt) items.push({ type: 'commit', timestamp: c.occurredAt, url: c.url });
    }
  }

  // pull requests
  for (const pr of coll.pullRequestContributions?.nodes ?? []) {
    if (pr && pr.occurredAt) {
      items.push({
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
      items.push({
        type: 'review',
        timestamp: rv.occurredAt,
        text: 'review',
        url: rv.pullRequestReview?.url,
      });
    }
  }

  items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const byHour = new Map<string, Item[]>();
  for (const it of items) {
    const h = dayjs(it.timestamp).format('YYYY-MM-DD HH:00');
    if (!byHour.has(h)) byHour.set(h, []);
    byHour.get(h)!.push(it);
  }

  for (const [hour, list] of [...byHour.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`\n## ${hour}`);
    for (const it of list) {
      const line = argv['with-links']
        ? `${it.type}: ${it.timestamp} - ${it.text ?? ''} (${it.url ?? ''})`
        : `${it.type}: ${it.timestamp} - ${it.text ?? ''}`;
      console.log(line);
    }
  }
}

// Top-level run with proper error handling to avoid unhandled rejections
main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
