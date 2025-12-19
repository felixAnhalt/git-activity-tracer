import type { OutputFormat } from '../types.js';

/**
 * File output formats (excludes console output).
 */
export type FileOutputFormat = Exclude<OutputFormat, 'console'>;

/**
 * Parsed and validated CLI arguments.
 */
export interface CliArguments {
  /** Start date in YYYY-MM-DD format, or undefined for default (Monday of current week) */
  from?: string;
  /** End date in YYYY-MM-DD format, or undefined for default (today) */
  to?: string;
  withLinks: boolean;
  output: OutputFormat;
  showConfig: boolean;
}
