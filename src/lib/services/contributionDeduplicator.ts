import type { Contribution } from '../../types.js';

/**
 * Common base branch names to prioritize in deduplication.
 * When duplicates exist, we prefer commits shown as being on these branches.
 */
const BASE_BRANCHES = ['main', 'master', 'develop', 'development', 'trunk'];

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
 * Determines if a branch is a base branch (main, master, develop, etc.)
 */
const isBaseBranch = (branchName: string | undefined): boolean => {
  if (!branchName) return false;
  return BASE_BRANCHES.includes(branchName.toLowerCase());
};

/**
 * Determines which contribution to prefer when duplicates are found.
 * Priority order:
 * 1. Contributions from base branches (main, master, develop, etc.)
 * 2. Contributions with target branch info over those without
 * 3. First one encountered (existing)
 */
const preferContribution = (existing: Contribution, candidate: Contribution): Contribution => {
  const existingIsBaseBranch = isBaseBranch(existing.target);
  const candidateIsBaseBranch = isBaseBranch(candidate.target);

  // If candidate is from base branch but existing isn't, prefer candidate
  if (candidateIsBaseBranch && !existingIsBaseBranch) {
    return candidate;
  }

  // If existing is from base branch but candidate isn't, keep existing
  if (existingIsBaseBranch && !candidateIsBaseBranch) {
    return existing;
  }

  // Both are base branches or both are feature branches
  // Prefer contribution with target (branch name) over one without
  if (candidate.target && !existing.target) {
    return candidate;
  }

  // Otherwise keep existing
  return existing;
};

/**
 * Deduplicates an array of contributions.
 * Strategy:
 * - For commits/PRs/reviews with URLs: deduplicate by URL (most reliable)
 * - For contributions without URLs: use composite key (type|timestamp|text|repository|target)
 *
 * When duplicates are found, prefer contributions with base branch info (main, master, etc.)
 * over feature branches, and prefer contributions with branch info over those without.
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
      // Duplicate found - use smart preference logic
      const existing = seen.get(key)!;
      const preferred = preferContribution(existing, contribution);
      seen.set(key, preferred);
    }
  }

  return Array.from(seen.values());
};
