import { parseRange } from '../../utils.js';
import { createFormatter } from '../../formatters/index.js';
import { initializeConnector } from '../../lib/initialization.js';
import { writeOutput } from '../io/output.js';
import type { CliArguments } from '../types.js';

/**
 * Fetches contributions, formats them, and writes output.
 * This is the core business logic that orchestrates the main workflow.
 *
 * @param cliArguments - Parsed CLI arguments
 */
export const runContributionReport = async (cliArguments: CliArguments): Promise<void> => {
  try {
    // Initialize
    const connector = await initializeConnector();
    const { from, to } = parseRange(cliArguments.from, cliArguments.to);

    // Fetch data
    const contributions = await connector.fetchContributions(from, to);

    // Format data
    const formatter = createFormatter(cliArguments.output);
    const result = formatter.format(contributions, {
      withLinks: cliArguments.withLinks,
    });

    // Write output
    await writeOutput(result.content, cliArguments.output, from, to);
  } catch (error) {
    console.error(
      'Error generating contribution report:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
};
