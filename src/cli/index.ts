import { parseCliArguments } from './parser.js';
import { handleShowConfigCommand } from './commands/show-config.js';
import { handleProjectIdCommand } from './commands/project-id.js';
import { runContributionReport } from './commands/report.js';

/**
 * Main CLI entry point.
 * Parses arguments and routes to appropriate command handler.
 *
 * Handles:
 * - --show-config: Display configuration and exit
 * - --project-id: Manage repository project ID mappings
 * - default: Run contribution report
 */
export const main = async () => {
  try {
    const cliArguments = parseCliArguments();

    if (cliArguments.showConfig) {
      handleShowConfigCommand();
      return;
    }

    if (cliArguments.projectIdCommand) {
      await handleProjectIdCommand(cliArguments.projectIdArgs ?? []);
      return;
    }

    await runContributionReport(cliArguments);
  } catch (error) {
    console.error('Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};
