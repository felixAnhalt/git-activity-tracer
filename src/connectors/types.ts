import type { Dayjs } from 'dayjs';
import type { Contribution } from '../types.js';

/**
 * Generic connector interface for fetching contributions from different platforms.
 * Implementations: GitHubConnector, GitLabConnector
 */
export interface Connector {
  /**
   * Fetches all contributions for the authenticated user within the date range.
   * @param from - Start date of the range
   * @param to - End date of the range
   * @returns Array of contributions
   */
  fetchContributions(from: Dayjs, to: Dayjs): Promise<Contribution[]>;

  /**
   * Fetches all commits from ALL branches for the authenticated user within the date range.
   * Unlike fetchContributions which filters by base branches, this fetches commits from all branches.
   * @param from - Start date of the range
   * @param to - End date of the range
   * @returns Array of commit contributions only
   */
  fetchAllCommits(from: Dayjs, to: Dayjs): Promise<Contribution[]>;

  /**
   * Gets the authenticated user's login/username.
   * @returns User login/username
   */
  getUserLogin(): Promise<string>;

  /**
   * Returns the platform name for this connector.
   * Used for logging and debugging.
   */
  getPlatformName(): string;
}

export type ConnectorType = 'github' | 'gitlab';
