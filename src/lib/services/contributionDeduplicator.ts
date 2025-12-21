import type { Contribution } from '../../types.js';

/**
 * Creates a composite key for a contribution.
 * For commits with URLs, use URL as primary identifier (most reliable).
 * For contributions without URLs, fall back to composite key.
 * This handles cases where the same commit appears from multiple sources
 * with different branch information (target field).
 */
const makeKey = (contribution: Contribution): string => {
  // For commits with URLs, use URL + type as the primary key
  // This ensures commits are deduplicated even if branch info differs
  if (contribution.url && contribution.type === 'commit') {
    return `commit|${contribution.url}`;
  }

  // For PRs and reviews, URL is also unique
  if (contribution.url && (contribution.type === 'pr' || contribution.type === 'review')) {
    return `${contribution.type}|${contribution.url}`;
  }

  // Fallback for contributions without URLs: use full composite key
  return `${contribution.type}|${contribution.timestamp}|${contribution.url ?? ''}|${contribution.text ?? ''}|${contribution.repository ?? ''}|${contribution.target ?? ''}`;
};

/**
 * Deduplicates an array of contributions.
 * Strategy:
 * - For commits/PRs/reviews with URLs: deduplicate by URL (most reliable)
 * - For contributions without URLs: use composite key (type|timestamp|text|repository|target)
 *
 * When duplicates are found, prefer contributions with more complete information
 * (e.g., prefer entry with branch name over entry without).
 *
 * @param contributions - Array of contributions to deduplicate
 * @returns Array of unique contributions in original order
 */
export const deduplicateContributions = (contributions: Contribution[]): Contribution[] => {
  const seen = new Map<string, Contribution>();

  for (const contribution of contributions) {
    const key = makeKey(contribution);

    if (!seen.has(key)) {
      // First time seeing this contribution
      seen.set(key, contribution);
    } else {
      // Duplicate found - prefer the one with more information
      const existing = seen.get(key)!;

      // Prefer contribution with target (branch name) over one without
      if (contribution.target && !existing.target) {
        seen.set(key, contribution);
      }
      // If both have target or both don't have target, keep the first one (existing)
    }
  }

  return Array.from(seen.values());
};
