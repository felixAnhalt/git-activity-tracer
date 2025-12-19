#!/usr/bin/env ts-node

import yargs from 'yargs';
import dayjs from 'dayjs';
import { parseRange } from './utils.js';
import { createGitHubConnector, type Contribution } from './connectors/github.js';

const argv = yargs(process.argv.slice(2))
  .option('from', { type: 'string' })
  .option('to', { type: 'string' })
  .option('with-links', { type: 'boolean', default: false })
  .parseSync();

async function main() {
  const connector = createGitHubConnector(process.env.GH_TOKEN);
  const { from, to } = parseRange(argv.from, argv.to);

  const items = await connector.fetchContributions(from, to);

  if (items.length === 0) {
    console.log('No contributions found in this range');
    return;
  }

  items.sort((a, b) => dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf());

  const byHour = new Map<string, Contribution[]>();
  for (const item of items) {
    const h = dayjs(item.timestamp).format('YYYY-MM-DD HH:00');
    if (!byHour.has(h)) byHour.set(h, []);
    byHour.get(h)!.push(item);
  }

  for (const [hour, list] of byHour) {
    console.log(`\n## ${hour}`);
    for (const contribution of list) {
      const ts = dayjs(contribution.timestamp).format('HH:mm:ss');
      const parts = [contribution.type, ts];
      if (contribution.text) {
        parts.push(contribution.text);
      }
      if (argv['with-links'] && contribution.url) parts.push(`(${contribution.url})`);
      console.log(parts.join(': '));
    }
  }
}

// Top-level run with proper error handling to avoid unhandled rejections
main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
