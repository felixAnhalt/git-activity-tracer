import { parseCliArguments } from './parser.js';
import { handleShowConfigCommand } from './commands/showConfig.js';
import { handleProjectIdCommand } from './commands/projectId.js';
import { runContributionReport } from './commands/report.js';
import { runAllCommitsReport } from './commands/allCommits.js';
import { handleError } from './errorHandler.js';

/**
 * Main CLI entry point.
 * Parses arguments and routes to appropriate command handler.
 *
 * Handles:
 * - config: Display configuration and exit
 * - project-id: Manage repository project ID mappings
 * - all-commits: Show all commits from all branches
 * - default: Run contribution report
 */
export const main = async () => {
  try {
    const cliArguments = parseCliArguments();

    if (cliArguments.showConfig) {
      await handleShowConfigCommand();
      return;
    }

    if (cliArguments.projectIdCommand) {
      await handleProjectIdCommand(cliArguments.projectIdArgs ?? []);
      return;
    }

    if (cliArguments.commandType === 'all-commits') {
      await runAllCommitsReport(cliArguments);
      return;
    }

    await runContributionReport(cliArguments);
  } catch (error) {
    handleError(error);
  }
};
