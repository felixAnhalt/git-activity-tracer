import { parseCliArguments } from './parser.js';
import { handleShowConfigCommand } from './commands/show-config.js';
import { runContributionReport } from './commands/report.js';

/**
 * Main CLI entry point.
 * Parses arguments and routes to appropriate command handler.
 *
 * Handles:
 * - --show-config: Display configuration and exit
 * - default: Run contribution report
 */
export const main = async () => {
  try {
    const cliArguments = parseCliArguments();

    if (cliArguments.showConfig) {
      handleShowConfigCommand();
      return;
    }

    await runContributionReport(cliArguments);
  } catch (error) {
    console.error('Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};
