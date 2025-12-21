import { parseRange } from '../../lib/time/dateRanges.js';
import { createFormatter } from '../../formatters/index.js';
import { initializeConnectors } from '../../lib/initialization.js';
import { writeOutput } from '../io/output.js';
import { loadConfiguration } from '../../lib/config/index.js';
import { generateReport } from '../../lib/services/reportGenerator.js';
import type { CliArguments } from '../types.js';

/**
 * Fetches contributions, formats them, and writes output.
 * This is the core command that orchestrates the main workflow.
 * Supports fetching from multiple platforms simultaneously.
 *
 * @param cliArguments - Parsed CLI arguments
 */
export const runContributionReport = async (cliArguments: CliArguments): Promise<void> => {
  // Initialize all available connectors
  const connectors = await initializeConnectors();
  const configuration = await loadConfiguration();
  const { from, to } = parseRange(
    cliArguments.from,
    cliArguments.to,
    cliArguments.lastweek,
    cliArguments.lastmonth,
  );

  console.log(
    `Generating all-commits report from ${from.format('YYYY-MM-DD')} to ${to.format('YYYY-MM-DD')}...\n`,
  );

  // Generate report using service layer
  const contributions = await generateReport(connectors, configuration, from, to);

  // Format data
  const formatter = createFormatter(cliArguments.output);
  const result = formatter.format(contributions, {
    withLinks: cliArguments.withLinks,
  });

  // Write output
  await writeOutput(result.content, cliArguments.output, from, to);
};
