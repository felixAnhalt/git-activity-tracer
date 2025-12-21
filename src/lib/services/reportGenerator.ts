import type { Dayjs } from 'dayjs';
import type { Contribution } from '../../types.js';
import type { Connector } from '../../connectors/types.js';
import type { Configuration } from '../config/index.js';
import { deduplicateContributions } from './contributionDeduplicator.js';

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

  // Deduplicate contributions
  const uniqueContributions = deduplicateContributions(allContributions);

  // Sort by timestamp (newest first)
  return uniqueContributions.sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
};

/**
 * Enriches contributions with projectId by looking up repository names
 * in the configuration's repositoryProjectIds mapping.
 */
const enrichContributionsWithProjectIds = (
  contributions: Contribution[],
  repositoryProjectIds: Record<string, string>,
): Contribution[] => {
  return contributions.map((contribution) => {
    if (contribution.repository) {
      const projectId = repositoryProjectIds[contribution.repository];
      if (projectId) {
        return { ...contribution, projectId };
      }
    }
    return contribution;
  });
};

/**
 * Generates a contribution report for the given date range.
 * Fetches contributions from all connectors in parallel, deduplicates them,
 * enriches with project IDs, and sorts by timestamp.
 *
 * @param connectors - Array of connector instances
 * @param configuration - Application configuration
 * @param from - Start date for the report
 * @param to - End date for the report
 * @returns Array of enriched and deduplicated contributions
 */
export const generateReport = async (
  connectors: Connector[],
  configuration: Configuration,
  from: Dayjs,
  to: Dayjs,
): Promise<Contribution[]> => {
  const connectorsWithNames = connectors.map((connector) => ({
    connector,
    name: connector.getPlatformName(),
  }));

  console.log(
    `Initialized ${connectors.length} connector(s): ${connectorsWithNames.map((c) => c.name).join(', ')}`,
  );

  const contributions = await fetchAndMergeContributions(connectorsWithNames, from, to);
  const enrichedContributions = enrichContributionsWithProjectIds(
    contributions,
    configuration.repositoryProjectIds ?? {},
  );

  console.log(`\nTotal: ${enrichedContributions.length} unique contributions\n`);

  return enrichedContributions;
};

/**
 * Generates a commits-only report for the given date range.
 * Fetches all contributions from connectors, filters to commits only,
 * enriches with project IDs, and sorts by timestamp.
 *
 * @param connectors - Array of connector instances
 * @param configuration - Application configuration
 * @param from - Start date for the report
 * @param to - End date for the report
 * @returns Array of commit contributions only
 */
export const generateCommitsReport = async (
  connectors: Connector[],
  configuration: Configuration,
  from: Dayjs,
  to: Dayjs,
): Promise<Contribution[]> => {
  const connectorsWithNames = connectors.map((connector) => ({
    connector,
    name: connector.getPlatformName(),
  }));

  console.log(
    `Initialized ${connectors.length} connector(s): ${connectorsWithNames.map((c) => c.name).join(', ')}`,
  );
  console.log('Fetching commits only (excluding PRs and reviews)...\n');

  const allContributions = await fetchAndMergeContributions(connectorsWithNames, from, to);

  // Filter to commits only
  const commits = allContributions.filter((contribution) => contribution.type === 'commit');

  const enrichedCommits = enrichContributionsWithProjectIds(
    commits,
    configuration.repositoryProjectIds ?? {},
  );

  console.log(`\nTotal: ${enrichedCommits.length} commits\n`);

  return enrichedCommits;
};
