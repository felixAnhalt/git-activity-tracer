import { Command } from 'commander';
import type { OutputFormat } from '../types.js';
import type { CliArguments } from './types.js';

/**
 * Parses command-line arguments using commander.
 * Returns strongly-typed, validated CLI arguments.
 *
 * @returns Parsed CLI arguments
 */
export const parseCliArguments = (): CliArguments => {
  const program = new Command();

  program
    .name('git-activity-tracer')
    .description('Track development activity across GitHub and GitLab')
    .version('1.0.0')
    .argument('[from]', 'Start date (YYYY-MM-DD or preset: last-week, last-month, this-week)')
    .argument('[to]', 'End date (YYYY-MM-DD)')
    .option('-f, --format <type>', 'Output format', 'console')
    .option('-l, --with-links', 'Include URLs in output', false)
    .action(() => {
      // Default action - handled by the absence of subcommands
    });

  // Project ID management subcommand
  const projectIdCommand = program
    .command('project-id')
    .description('Manage repository project ID mappings');

  projectIdCommand
    .command('list')
    .description('List all project ID mappings')
    .action(() => {
      // Handled in main CLI logic
    });

  projectIdCommand
    .command('add <repository> <projectId>')
    .description('Add a project ID mapping for a repository')
    .action(() => {
      // Handled in main CLI logic
    });

  projectIdCommand
    .command('remove <repository>')
    .description('Remove a project ID mapping for a repository')
    .action(() => {
      // Handled in main CLI logic
    });

  // Config command
  program
    .command('config')
    .description('Show configuration file location and usage')
    .action(() => {
      // Handled in main CLI logic
    });

  program.parse(process.argv);

  const options = program.opts();
  const args = program.args;

  // Determine which command was called
  const commandName = program.args[0];

  // Handle project-id subcommand
  if (commandName === 'project-id') {
    const subcommand = args[1];
    const subArgs = args.slice(2);

    return {
      output: 'console',
      withLinks: false,
      showConfig: false,
      projectIdCommand: true,
      projectIdArgs: [subcommand, ...subArgs],
    };
  }

  // Handle config command
  if (commandName === 'config') {
    return {
      output: 'console',
      withLinks: false,
      showConfig: true,
    };
  }

  // Handle date range presets
  let from: string | undefined;
  let to: string | undefined;
  let lastweek = false;
  let lastmonth = false;

  if (args.length > 0 && typeof args[0] === 'string') {
    const firstArgument = args[0].toLowerCase();
    if (firstArgument === 'last-week' || firstArgument === 'lastweek') {
      lastweek = true;
    } else if (firstArgument === 'last-month' || firstArgument === 'lastmonth') {
      lastmonth = true;
    } else if (firstArgument === 'this-week' || firstArgument === 'thisweek') {
      // Default behavior - use current week
    } else {
      from = args[0];
      to = args[1];
    }
  }

  // Default report generation
  return {
    from,
    to,
    lastweek,
    lastmonth,
    withLinks: options.withLinks,
    output: (options.format as OutputFormat) ?? 'console',
    showConfig: false,
  };
};
