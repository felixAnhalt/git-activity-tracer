import type { Contribution } from '../../types.js';

/**
 * Creates a composite key for a contribution.
 * Used for deduplication based on type, timestamp, url, text, repository, and target.
 */
const makeKey = (contribution: Contribution): string => {
  return `${contribution.type}|${contribution.timestamp}|${contribution.url ?? ''}|${contribution.text ?? ''}|${contribution.repository ?? ''}|${contribution.target ?? ''}`;
};

/**
 * Deduplicates an array of contributions.
 * Uses a composite key of type, timestamp, url, text, repository, and target
 * to uniquely identify contributions.
 *
 * @param contributions - Array of contributions to deduplicate
 * @returns Array of unique contributions in original order
 */
export const deduplicateContributions = (contributions: Contribution[]): Contribution[] => {
  const seen = new Map<string, Contribution>();

  for (const contribution of contributions) {
    const key = makeKey(contribution);
    if (!seen.has(key)) {
      seen.set(key, contribution);
    }
  }

  return Array.from(seen.values());
};
