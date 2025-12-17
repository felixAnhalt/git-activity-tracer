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
  const { from, to } = parseRange(argv.from as string | undefined, argv.to as string | undefined);

  const items = await connector.fetchContributions(from, to);

  // Sort by timestamp using dayjs consistently
  items.sort((a, b) => dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf());

  const byHour = new Map<string, Contribution[]>();
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
