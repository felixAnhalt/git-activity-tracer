import type { Dayjs } from 'dayjs';
import { parseRange } from '../../utils.js';
import { createFormatter } from '../../formatters/index.js';
import { initializeConnectors } from '../../lib/initialization.js';
import { writeOutput } from '../io/output.js';
import type { CliArguments } from '../types.js';
import type { Contribution } from '../../types.js';
import type { Connector } from '../../connectors/types.js';

/**
 * Fetches contributions from multiple connectors and merges them.
 * Contributions are deduplicated and sorted by timestamp.
 */
const fetchAndMergeContributions = async (
  connectors: Array<{ connector: Connector; name: string }>,
  from: Dayjs,
  to: Dayjs,
): Promise<Contribution[]> => {
  const allContributions: Contribution[] = [];

  // Fetch from all connectors in parallel
  const results = await Promise.allSettled(
    connectors.map(async ({ connector, name }) => {
      console.log(`Fetching contributions from ${name}...`);
      const contributions = await connector.fetchContributions(from, to);
      console.log(`✓ Found ${contributions.length} contributions from ${name}`);
      return contributions;
    }),
  );

  // Collect successful results
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allContributions.push(...result.value);
    } else {
      console.warn(`Warning: Failed to fetch from a connector: ${result.reason}`);
    }
  }

  // Deduplicate by composite key
  const uniqueContributions = new Map<string, Contribution>();
  for (const contribution of allContributions) {
    const key = `${contribution.type}|${contribution.timestamp}|${contribution.url ?? ''}|${contribution.text ?? ''}|${contribution.repository ?? ''}|${contribution.target ?? ''}`;
    if (!uniqueContributions.has(key)) {
      uniqueContributions.set(key, contribution);
    }
  }

  // Sort by timestamp (newest first)
  return Array.from(uniqueContributions.values()).sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
};

/**
 * Fetches contributions, formats them, and writes output.
 * This is the core business logic that orchestrates the main workflow.
 * Supports fetching from multiple platforms simultaneously.
 *
 * @param cliArguments - Parsed CLI arguments
 */
export const runContributionReport = async (cliArguments: CliArguments): Promise<void> => {
  try {
    // Initialize all available connectors
    const connectors = await initializeConnectors();
    const { from, to } = parseRange(cliArguments.from, cliArguments.to);

    // Get platform names for logging
    const connectorsWithNames = connectors.map((connector) => ({
      connector,
      name: connector.getPlatformName(),
    }));

    console.log(
      `Initialized ${connectors.length} connector(s): ${connectorsWithNames.map((c) => c.name).join(', ')}`,
    );

    // Fetch and merge data from all connectors
    const contributions = await fetchAndMergeContributions(connectorsWithNames, from, to);

    console.log(`\nTotal: ${contributions.length} unique contributions\n`);

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
