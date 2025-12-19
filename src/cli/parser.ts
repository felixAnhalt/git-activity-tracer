import yargs from 'yargs';
import type { OutputFormat } from '../types.js';
import type { CliArguments } from './types.js';

/**
 * Parses command-line arguments using yargs.
 * Returns strongly-typed, validated CLI arguments.
 *
 * @returns Parsed CLI arguments
 */
export const parseCliArguments = (): CliArguments => {
  const argv = yargs(process.argv.slice(2))
    .option('from', {
      type: 'string',
      description: 'Start date (YYYY-MM-DD). Defaults to Monday of current week',
    })
    .option('to', {
      type: 'string',
      description: 'End date (YYYY-MM-DD). Defaults to today',
    })
    .option('lastweek', {
      type: 'boolean',
      default: false,
      description: 'Fetch data for last week (Monday to Sunday)',
    })
    .option('lastmonth', {
      type: 'boolean',
      default: false,
      description: 'Fetch data for last month (1st to last day)',
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
    .option('show-config', {
      type: 'boolean',
      default: false,
      description: 'Show configuration file location and exit',
    })
    .option('project-id', {
      type: 'boolean',
      default: false,
      description: 'Manage repository project ID mappings: add|remove|list',
    })
    .help()
    .alias('help', 'h')
    .parseSync();

  return {
    from: argv.from,
    to: argv.to,
    lastweek: argv.lastweek,
    lastmonth: argv.lastmonth,
    withLinks: argv['with-links'],
    output: argv.output as OutputFormat,
    showConfig: argv['show-config'],
    projectIdCommand: argv['project-id'],
    projectIdArgs: argv['project-id'] ? argv._.map(String) : undefined,
  };
};
