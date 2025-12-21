import { parseRange } from '../../lib/time/dateRanges.js';
import { createFormatter } from '../../formatters/index.js';
import { initializeConnectors } from '../../lib/initialization.js';
import { writeOutput } from '../io/output.js';
import { loadConfiguration } from '../../lib/config/index.js';
import { generateCommitsReport } from '../../lib/services/reportGenerator.js';
import type { CliArguments } from '../types.js';

/**
 * Fetches all commits from all branches, formats them, and writes output.
 * Shows all commit contributions from all branches (includes feature branches).
 *
 * @param cliArguments - Parsed CLI arguments
 */
export const runAllCommitsReport = async (cliArguments: CliArguments): Promise<void> => {
  // Initialize all available connectors
  const connectors = await initializeConnectors();
  const configuration = await loadConfiguration();
  const { from, to } = parseRange(
    cliArguments.from,
    cliArguments.to,
    cliArguments.lastweek,
    cliArguments.lastmonth,
  );

  // Generate all-commits report using service layer
  const commits = await generateCommitsReport(connectors, configuration, from, to);

  // Format data
  const formatter = createFormatter(cliArguments.output);
  const result = formatter.format(commits, {
    withLinks: cliArguments.withLinks,
  });

  // Write output
  await writeOutput(result.content, cliArguments.output, from, to);
};
