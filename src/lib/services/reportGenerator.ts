import type { Dayjs } from 'dayjs';
import type { Contribution } from '../../types.js';
import type { Connector } from '../../connectors/types.js';
import type { Configuration } from '../config/index.js';
import { deduplicateContributions } from './contributionDeduplicator.js';
import { loadCache, saveCache } from './cacheManager.js';

/**
 * Fetches contributions from multiple connectors with caching support.
 * Contributions are deduplicated and sorted by timestamp.
 */
const fetchAndMergeContributions = async (
  connectors: Array<{ connector: Connector; name: string }>,
  from: Dayjs,
  to: Dayjs,
  useCache: boolean,
): Promise<Contribution[]> => {
  const allContributions: Contribution[] = [];

  // Fetch from all connectors in parallel
  const results = await Promise.allSettled(
    connectors.map(async ({ connector, name }) => {
      const platform = connector.getPlatformName();
      const username = await connector.getUserLogin();

      if (useCache) {
        // Load cache
        const cachedContributions = await loadCache(platform, username);

        if (cachedContributions.length > 0) {
          console.log(`Loaded ${cachedContributions.length} cached contributions from ${name}`);
        }

        // Always fetch fresh data for the requested range
        console.log(`Fetching contributions from ${name}...`);
        const freshContributions = await connector.fetchContributions(from, to);
        console.log(`✓ Found ${freshContributions.length} contributions from ${name}`);

        // Save to cache (will merge with existing)
        await saveCache(platform, username, freshContributions);

        // Return fresh contributions (cache is saved for future use)
        return freshContributions;
      } else {
        // No cache - fetch directly
        console.log(`Fetching contributions from ${name}...`);
        const contributions = await connector.fetchContributions(from, to);
        console.log(`✓ Found ${contributions.length} contributions from ${name}`);
        return contributions;
      }
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
 * @param useCache - Whether to use caching (default: true)
 * @returns Array of enriched and deduplicated contributions
 */
export const generateReport = async (
  connectors: Connector[],
  configuration: Configuration,
  from: Dayjs,
  to: Dayjs,
  useCache = true,
): Promise<Contribution[]> => {
  const connectorsWithNames = connectors.map((connector) => ({
    connector,
    name: connector.getPlatformName(),
  }));

  console.log(
    `Initialized ${connectors.length} connector(s): ${connectorsWithNames.map((c) => c.name).join(', ')}`,
  );

  const contributions = await fetchAndMergeContributions(connectorsWithNames, from, to, useCache);
  const enrichedContributions = enrichContributionsWithProjectIds(
    contributions,
    configuration.repositoryProjectIds ?? {},
  );

  console.log(`\nTotal: ${enrichedContributions.length} unique contributions\n`);

  return enrichedContributions;
};

/**
 * Generates a comprehensive report including ALL contributions.
 * This includes:
 * - All commits from ALL branches (including feature branches)
 * - Pull requests
 * - Reviews
 *
 * Unlike generateReport() which only includes base branch commits,
 * this fetches commits from every branch the user has pushed to.
 *
 * @param connectors - Array of connector instances
 * @param configuration - Application configuration
 * @param from - Start date for the report
 * @param to - End date for the report
 * @param useCache - Whether to use caching (default: true)
 * @returns Array of all contributions (commits from all branches + PRs + reviews)
 */
export const generateCommitsReport = async (
  connectors: Connector[],
  configuration: Configuration,
  from: Dayjs,
  to: Dayjs,
  useCache = true,
): Promise<Contribution[]> => {
  const connectorsWithNames = connectors.map((connector) => ({
    connector,
    name: connector.getPlatformName(),
  }));

  console.log(
    `Initialized ${connectors.length} connector(s): ${connectorsWithNames.map((c) => c.name).join(', ')}`,
  );
  console.log('Fetching all commits from all branches...\n');

  const allContributions: Contribution[] = [];

  // Fetch from all connectors in parallel
  // Each connector fetches both all commits AND regular contributions (PRs, reviews)
  const results = await Promise.allSettled(
    connectorsWithNames.map(async ({ connector, name }) => {
      const platform = connector.getPlatformName();
      const username = await connector.getUserLogin();

      if (useCache) {
        // Load cache
        const cachedContributions = await loadCache(platform, username);

        if (cachedContributions.length > 0) {
          console.log(`Loaded ${cachedContributions.length} cached contributions from ${name}`);
        }

        // Always fetch fresh data
        console.log(`Fetching commits from ${name}...`);
        const commits = await connector.fetchAllCommits(from, to);

        console.log(`Fetching regular contributions from ${name}`);
        const regularContributions = await connector.fetchContributions(from, to);

        console.log(
          `✓ Found ${commits.length + regularContributions.length} contributions from ${name}`,
        );

        // Merge both sets of contributions
        const freshContributions = [...commits, ...regularContributions];

        // Save to cache
        await saveCache(platform, username, freshContributions);

        // Return fresh contributions
        return freshContributions;
      } else {
        console.log(`Fetching commits from ${name}...`);

        // Fetch commits from all branches
        const commits = await connector.fetchAllCommits(from, to);

        console.log(`Fetching regular contributions from ${name}`);
        // Also fetch regular contributions (PRs, reviews, and base branch commits)
        const regularContributions = await connector.fetchContributions(from, to);

        console.log(
          `✓ Found ${commits.length + regularContributions.length} contributions from ${name}`,
        );

        // Merge both sets of contributions
        return [...commits, ...regularContributions];
      }
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

  // Deduplicate contributions (important since we might get same commits from both methods)
  const uniqueContributions = deduplicateContributions(allContributions);

  // Sort by timestamp (newest first)
  const sortedContributions = uniqueContributions.sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // Enrich with project IDs
  const enrichedContributions = enrichContributionsWithProjectIds(
    sortedContributions,
    configuration.repositoryProjectIds ?? {},
  );

  console.log(`\nTotal: ${enrichedContributions.length} unique contributions\n`);

  return enrichedContributions;
};
