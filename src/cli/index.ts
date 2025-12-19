import yargs from 'yargs';
import { promises as fs } from 'fs';
import path from 'path';
import { parseRange } from '../utils.js';
import { createGitHubConnector } from '../connectors/github.js';
import { createFormatter } from '../formatters/index.js';
import type { OutputFormat } from '../types.js';

export async function main() {
  const argv = yargs(process.argv.slice(2))
    .option('from', {
      type: 'string',
      description: 'Start date (YYYY-MM-DD). Defaults to Monday of current week',
    })
    .option('to', {
      type: 'string',
      description: 'End date (YYYY-MM-DD). Defaults to today',
    })
    .option('with-links', {
      type: 'boolean',
      default: false,
      description: 'Include URLs in output',
    })
    .option('output', {
      type: 'string',
      choices: ['console', 'json', 'csv'] as const,
      default: 'console' as const,
      description: 'Output format',
    })
    .help()
    .alias('help', 'h')
    .parseSync();

  const connector = createGitHubConnector(process.env.GH_TOKEN);
  const { from, to } = parseRange(argv.from, argv.to);

  const contributions = await connector.fetchContributions(from, to);

  const formatter = createFormatter(argv.output as OutputFormat);
  const result = formatter.format(contributions, {
    withLinks: argv['with-links'],
  });

  // Handle output
  if (argv.output === 'console') {
    console.log(result.content);
  } else {
    // Generate filename for file outputs
    const fromFormatted = from.format('YYYY-MM-DD');
    const toFormatted = to.format('YYYY-MM-DD');
    const extension = argv.output === 'json' ? 'json' : 'csv';
    const filename = `git-contributions-${fromFormatted}-${toFormatted}.${extension}`;
    const filepath = path.resolve(process.cwd(), filename);

    await fs.writeFile(filepath, result.content, 'utf-8');
    console.log(`Output written to: ${filename}`);
  }
}
