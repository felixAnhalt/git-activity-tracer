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
    .help()
    .alias('help', 'h')
    .parseSync();

  return {
    from: argv.from,
    to: argv.to,
    withLinks: argv['with-links'],
    output: argv.output as OutputFormat,
    showConfig: argv['show-config'],
  };
};
