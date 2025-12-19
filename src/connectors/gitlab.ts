import { Gitlab } from '@gitbeaker/rest';
import type { Dayjs } from 'dayjs';
import type { Contribution } from '../types.js';
import type { Configuration } from '../configuration.js';
import type { Connector } from './types.js';
import type {
  GitLabUser,
  GitLabEvent,
  GitLabMergeRequest,
  GitLabProject,
  DateRange,
  DateRangeTimestamps,
} from './gitlab.types.js';

export type { Contribution, ContributionType } from '../types.js';

/**
 * GitLab connector - fetches contributions from GitLab API.
 * Supports commits, merge requests, and MR reviews/approvals.
 */
export class GitLabConnector implements Connector {
  private gitlab: InstanceType<typeof Gitlab>;
  private configuration: Configuration;
  private userId: number | null = null;

  constructor(gitlabOrToken: InstanceType<typeof Gitlab> | string, configuration: Configuration) {
    if (typeof gitlabOrToken === 'string') {
      if (!gitlabOrToken || gitlabOrToken.trim() === '') {
        throw new Error('A non-empty GitLab token string is required.');
      }
      this.gitlab = new Gitlab({
        token: gitlabOrToken,
        host: process.env.GITLAB_HOST,
      });
    } else if (!gitlabOrToken) {
      throw new Error('Gitlab instance or token string is required.');
    } else {
      this.gitlab = gitlabOrToken;
    }
    this.configuration = configuration;
  }

  getPlatformName(): string {
    return 'GitLab';
  }

  /**
   * Gets the authenticated user's username from GitLab.
   * Caches the user ID for later use.
   */
  async getUserLogin(): Promise<string> {
    const user = (await this.gitlab.Users.showCurrentUser()) as GitLabUser;
    if (!user?.username || typeof user.username !== 'string') {
      throw new Error('Unable to determine authenticated user username from GitLab.');
    }
    // Cache user ID for later use
    if (user.id) {
      this.userId = user.id;
    }
    return user.username;
  }

  /**
   * Gets the user ID. If not cached, fetches the current user.
   */
  private async getUserId(): Promise<number> {
    if (this.userId !== null) {
      return this.userId;
    }
    const user = (await this.gitlab.Users.showCurrentUser()) as GitLabUser;
    if (!user?.id) {
      throw new Error('Unable to determine authenticated user ID from GitLab.');
    }
    this.userId = user.id;
    return user.id;
  }

  /**
   * Parses ISO date strings to timestamps for efficient range checking.
   * @throws {Error} If date strings are invalid
   */
  private parseDateRangeTimestamps(dateRange: DateRange): DateRangeTimestamps {
    const fromTimestamp = Date.parse(dateRange.from);
    const toTimestamp = Date.parse(dateRange.to);

    if (Number.isNaN(fromTimestamp) || Number.isNaN(toTimestamp)) {
      throw new Error('Invalid date range provided');
    }

    return { fromTimestamp, toTimestamp };
  }

  /**
   * Extracts project path from GitLab URL.
   * @param url GitLab URL in format: https://gitlab.com/group/project/...
   * @returns Project path in format: group/project or undefined if unable to extract
   */
  private extractProjectFromUrl(url?: string): string | undefined {
    if (!url) return undefined;
    const match = url.match(/gitlab\.com\/([^/-]+\/[^/-]+)/);
    return match?.[1];
  }

  /**
   * Fetches user events from GitLab Events API.
   * Returns empty array on error (best-effort).
   */
  private async fetchEventsApiData(userId: number, dateRange: DateRange): Promise<GitLabEvent[]> {
    try {
      const events = (await this.gitlab.Users.allEvents(userId, {
        after: dateRange.from.split('T')[0],
        before: dateRange.to.split('T')[0],
        perPage: 100,
        maxPages: 10,
      })) as GitLabEvent[];

      if (!Array.isArray(events)) {
        return [];
      }

      return events;
    } catch (error) {
      // Log warnings for authentication or rate limit errors
      if (error && typeof error === 'object' && 'response' in error) {
        const response = (error as { response: { status: number } }).response;
        if (response.status === 401) {
          console.warn('Warning: GitLab Events API authentication failed. Check your token.');
        } else if (response.status === 403) {
          console.warn('Warning: GitLab Events API rate limit exceeded or access forbidden.');
        }
      }
      return [];
    }
  }

  /**
   * Fetches merge requests created by the user.
   */
  private async fetchMergeRequests(
    userId: number,
    dateRange: DateRange,
  ): Promise<GitLabMergeRequest[]> {
    try {
      const mergeRequests = (await this.gitlab.MergeRequests.all({
        authorId: userId,
        createdAfter: dateRange.from,
        createdBefore: dateRange.to,
        perPage: 100,
        maxPages: 10,
      })) as GitLabMergeRequest[];

      if (!Array.isArray(mergeRequests)) {
        return [];
      }

      return mergeRequests;
    } catch (error) {
      console.warn(
        `Warning: Failed to fetch merge requests: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Fetches project details for a given project ID.
   */
  private async fetchProject(projectId: number): Promise<GitLabProject | null> {
    try {
      const project = (await this.gitlab.Projects.show(projectId)) as GitLabProject;
      return project || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extracts commit contributions from push events.
   * Filters by date range and base branch references from configuration.
   */
  private async extractPushEventContributions(
    events: GitLabEvent[],
    dateRangeTimestamps: DateRangeTimestamps,
  ): Promise<Contribution[]> {
    const contributions: Contribution[] = [];

    // Build base branch references from configuration
    const baseBranchReferences = new Set(
      this.configuration.baseBranches.map((branch) => `refs/heads/${branch}`),
    );

    // Cache projects to avoid repeated API calls
    const projectCache = new Map<number, GitLabProject | null>();

    for (const event of events) {
      if (!event || typeof event !== 'object') continue;
      if (event.action_name !== 'pushed to' && event.action_name !== 'pushed new') continue;

      const createdAt = event.created_at;
      const reference = event.push_data?.ref;

      if (typeof createdAt !== 'string' || typeof reference !== 'string') continue;

      const createdTimestamp = Date.parse(createdAt);
      if (Number.isNaN(createdTimestamp)) continue;

      if (
        createdTimestamp <= dateRangeTimestamps.fromTimestamp ||
        createdTimestamp > dateRangeTimestamps.toTimestamp
      ) {
        continue;
      }

      if (!baseBranchReferences.has(reference)) continue;

      const projectId = event.project_id;
      const branchName = reference.replace('refs/heads/', '');
      const commitTitle = event.push_data?.commit_title;

      // Get project path for repository name
      let projectPath: string | undefined;
      if (projectId) {
        if (!projectCache.has(projectId)) {
          projectCache.set(projectId, await this.fetchProject(projectId));
        }
        const project = projectCache.get(projectId);
        projectPath = project?.path_with_namespace;
      }

      contributions.push({
        type: 'commit',
        timestamp: createdAt,
        text: commitTitle,
        url: undefined, // Push events don't include commit URLs
        repository: projectPath,
        target: branchName,
      });
    }

    return contributions;
  }

  /**
   * Extracts merge request contributions.
   */
  private async extractMergeRequestContributions(
    mergeRequests: GitLabMergeRequest[],
  ): Promise<Contribution[]> {
    const contributions: Contribution[] = [];

    // Cache projects to avoid repeated API calls
    const projectCache = new Map<number, GitLabProject | null>();

    for (const mergeRequest of mergeRequests) {
      if (!mergeRequest || typeof mergeRequest.created_at !== 'string') continue;

      // Get project path for repository name
      let projectPath: string | undefined;
      const projectId = mergeRequest.project_id;
      if (projectId) {
        if (!projectCache.has(projectId)) {
          projectCache.set(projectId, await this.fetchProject(projectId));
        }
        const project = projectCache.get(projectId);
        projectPath = project?.path_with_namespace;
      }

      // Fallback to extracting from URL if project fetch failed
      if (!projectPath) {
        projectPath = this.extractProjectFromUrl(mergeRequest.web_url);
      }

      contributions.push({
        type: 'pr', // Use 'pr' type for merge requests to maintain consistency
        timestamp: mergeRequest.created_at,
        text: mergeRequest.title,
        url: mergeRequest.web_url,
        repository: projectPath,
        target: mergeRequest.target_branch,
      });
    }

    return contributions;
  }

  /**
   * Extracts review/approval contributions from comment events.
   */
  private extractReviewContributions(
    events: GitLabEvent[],
    dateRangeTimestamps: DateRangeTimestamps,
  ): Contribution[] {
    const contributions: Contribution[] = [];

    for (const event of events) {
      if (!event || typeof event !== 'object') continue;

      // Check for MR comment/approval events
      if (
        event.action_name !== 'commented on' &&
        event.action_name !== 'approved' &&
        event.target_type !== 'MergeRequest'
      ) {
        continue;
      }

      const createdAt = event.created_at;
      if (typeof createdAt !== 'string') continue;

      const createdTimestamp = Date.parse(createdAt);
      if (Number.isNaN(createdTimestamp)) continue;

      if (
        createdTimestamp <= dateRangeTimestamps.fromTimestamp ||
        createdTimestamp > dateRangeTimestamps.toTimestamp
      ) {
        continue;
      }

      // Only count approvals as reviews (not all comments)
      if (event.action_name === 'approved') {
        contributions.push({
          type: 'review',
          timestamp: createdAt,
          text: 'review',
          url: undefined, // Event API doesn't provide direct MR URLs
          repository: undefined,
          target: undefined,
        });
      }
    }

    return contributions;
  }

  /**
   * Deduplicates contributions by composite key: type|timestamp|url|text|repository|target.
   */
  private deduplicateContributions(contributions: Contribution[]): Contribution[] {
    const uniqueContributions = new Map<string, Contribution>();

    for (const contribution of contributions) {
      const key = `${contribution.type}|${contribution.timestamp}|${contribution.url ?? ''}|${contribution.text ?? ''}|${contribution.repository ?? ''}|${contribution.target ?? ''}`;
      if (!uniqueContributions.has(key)) {
        uniqueContributions.set(key, contribution);
      }
    }

    return Array.from(uniqueContributions.values());
  }

  /**
   * Fetches all contributions for the authenticated user within the date range.
   * Combines Events API (commits, reviews) and Merge Requests API.
   */
  async fetchContributions(from: Dayjs, to: Dayjs): Promise<Contribution[]> {
    const userId = await this.getUserId();

    const dateRange: DateRange = {
      from: from.toISOString(),
      to: to.toISOString(),
    };

    const dateRangeTimestamps = this.parseDateRangeTimestamps(dateRange);

    const allContributions: Contribution[] = [];

    // Fetch events (commits, reviews)
    const events = await this.fetchEventsApiData(userId, dateRange);

    // Extract commits from push events
    allContributions.push(
      ...(await this.extractPushEventContributions(events, dateRangeTimestamps)),
    );

    // Extract reviews from approval events
    allContributions.push(...this.extractReviewContributions(events, dateRangeTimestamps));

    // Fetch and extract merge requests
    const mergeRequests = await this.fetchMergeRequests(userId, dateRange);
    allContributions.push(...(await this.extractMergeRequestContributions(mergeRequests)));

    return this.deduplicateContributions(allContributions);
  }
}

/**
 * Factory function to create a GitLab connector instance.
 */
export const createGitLabConnector = (
  token?: string,
  configuration?: Configuration,
): GitLabConnector => {
  if (token === undefined || token === null) {
    throw new Error(
      'GITLAB_TOKEN environment variable is missing. To create a GitLab token see https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html',
    );
  }
  if (token.trim() === '') {
    throw new Error('A non-empty GitLab token string is required.');
  }

  // Use provided configuration or defaults
  const finalConfiguration: Configuration = configuration ?? {
    baseBranches: ['main', 'master', 'develop', 'development'],
  };

  return new GitLabConnector(token, finalConfiguration);
};
