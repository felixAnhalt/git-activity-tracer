import type { OutputFormat } from '../types.js';

/**
 * File output formats (excludes console output).
 */
export type FileOutputFormat = Exclude<OutputFormat, 'console'>;

/**
 * Parsed and validated CLI arguments.
 */
export interface CliArguments {
  /** Command type: 'report' (default) or 'all-commits' */
  commandType?: 'report' | 'all-commits';
  /** Start date in YYYY-MM-DD format, or undefined for default (Monday of current week) */
  from?: string;
  /** End date in YYYY-MM-DD format, or undefined for default (today) */
  to?: string;
  /** Fetch data for last week (Monday to Sunday) */
  lastweek?: boolean;
  /** Fetch data for last month (1st to last day) */
  lastmonth?: boolean;
  withLinks: boolean;
  output: OutputFormat;
  showConfig: boolean;
  projectIdCommand?: boolean;
  projectIdArgs?: string[];
}
