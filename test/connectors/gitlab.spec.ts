import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitLabConnector, createGitLabConnector } from '../../src/connectors/gitlab.js';
import dayjs from 'dayjs';
import type { Gitlab } from '@gitbeaker/rest';

describe('GitLabConnector', () => {
  let connector: GitLabConnector;
  const mockGitlab = {
    Users: {
      showCurrentUser: vi.fn(),
      allEvents: vi.fn(),
    },
    MergeRequests: {
      all: vi.fn(),
    },
    Projects: {
      show: vi.fn(),
    },
  };

  const mockConfiguration = {
    baseBranches: ['main', 'master', 'develop', 'development'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // inject the mock Gitlab directly via constructor
    connector = new GitLabConnector(mockGitlab as unknown as Gitlab, mockConfiguration);
  });

  it('constructor should throw when constructed without token or Gitlab instance', () => {
    // @ts-expect-error runtime test
    expect(() => new GitLabConnector(undefined, mockConfiguration)).toThrow(
      'Gitlab instance or token string is required.',
    );
  });

  it('constructor should throw when constructed with empty token', () => {
    expect(() => new GitLabConnector('', mockConfiguration)).toThrow(
      'A non-empty GitLab token string is required.',
    );
  });

  describe('getPlatformName', () => {
    it('should return GitLab', () => {
      expect(connector.getPlatformName()).toBe('GitLab');
    });
  });

  describe('getUserLogin', () => {
    it('should return authenticated user username', async () => {
      mockGitlab.Users.showCurrentUser.mockResolvedValue({
        id: 123,
        username: 'testuser',
      });

      const username = await connector.getUserLogin();
      expect(username).toBe('testuser');
    });

    it('should throw when username is not available', async () => {
      mockGitlab.Users.showCurrentUser.mockResolvedValue({
        id: 123,
      });

      await expect(connector.getUserLogin()).rejects.toThrow(
        'Unable to determine authenticated user username from GitLab.',
      );
    });
  });

  describe('fetchContributions', () => {
    const from = dayjs('2025-01-01');
    const to = dayjs('2025-01-31');

    it('should fetch and parse contributions successfully', async () => {
      mockGitlab.Users.showCurrentUser.mockResolvedValue({
        id: 123,
        username: 'testuser',
      });

      // Events API response (commits)
      mockGitlab.Users.allEvents.mockResolvedValue([
        {
          id: 1,
          action_name: 'pushed to',
          created_at: '2025-01-15T10:00:00Z',
          project_id: 456,
          push_data: {
            ref: 'refs/heads/main',
            commit_title: 'Add feature',
          },
        },
      ]);

      // Merge Requests API response
      mockGitlab.MergeRequests.all.mockResolvedValue([
        {
          id: 789,
          iid: 1,
          title: 'Add new feature',
          created_at: '2025-01-16T14:30:00Z',
          target_branch: 'main',
          web_url: 'https://gitlab.com/test/repo/-/merge_requests/1',
          project_id: 456,
        },
      ]);

      // Project API response
      mockGitlab.Projects.show.mockResolvedValue({
        id: 456,
        path_with_namespace: 'test/repo',
      });

      const contributions = await connector.fetchContributions(from, to);

      expect(contributions).toHaveLength(2);

      // Check commit contribution
      const commit = contributions.find((c) => c.type === 'commit');
      expect(commit).toBeDefined();
      expect(commit?.text).toBe('Add feature');
      expect(commit?.repository).toBe('test/repo');
      expect(commit?.target).toBe('main');

      // Check merge request contribution
      const mr = contributions.find((c) => c.type === 'pr');
      expect(mr).toBeDefined();
      expect(mr?.text).toBe('Add new feature');
      expect(mr?.url).toBe('https://gitlab.com/test/repo/-/merge_requests/1');
      expect(mr?.repository).toBe('test/repo');
      expect(mr?.target).toBe('main');
    });

    it('should handle approval events as reviews', async () => {
      mockGitlab.Users.showCurrentUser.mockResolvedValue({
        id: 123,
        username: 'testuser',
      });

      mockGitlab.Users.allEvents.mockResolvedValue([
        {
          id: 1,
          action_name: 'approved',
          created_at: '2025-01-17T09:00:00Z',
          target_type: 'MergeRequest',
        },
      ]);

      mockGitlab.MergeRequests.all.mockResolvedValue([]);

      const contributions = await connector.fetchContributions(from, to);

      expect(contributions).toHaveLength(1);
      expect(contributions[0].type).toBe('review');
      expect(contributions[0].text).toBe('review');
    });

    it('should filter contributions by date range', async () => {
      mockGitlab.Users.showCurrentUser.mockResolvedValue({
        id: 123,
        username: 'testuser',
      });

      mockGitlab.Users.allEvents.mockResolvedValue([
        {
          id: 1,
          action_name: 'pushed to',
          created_at: '2024-12-31T23:00:00Z', // Before range
          project_id: 456,
          push_data: {
            ref: 'refs/heads/main',
            commit_title: 'Old commit',
          },
        },
        {
          id: 2,
          action_name: 'pushed to',
          created_at: '2025-01-15T10:00:00Z', // In range
          project_id: 456,
          push_data: {
            ref: 'refs/heads/main',
            commit_title: 'New commit',
          },
        },
        {
          id: 3,
          action_name: 'pushed to',
          created_at: '2025-02-01T10:00:00Z', // After range
          project_id: 456,
          push_data: {
            ref: 'refs/heads/main',
            commit_title: 'Future commit',
          },
        },
      ]);

      mockGitlab.MergeRequests.all.mockResolvedValue([]);
      mockGitlab.Projects.show.mockResolvedValue({
        id: 456,
        path_with_namespace: 'test/repo',
      });

      const contributions = await connector.fetchContributions(from, to);

      // Debug: log contributions to see what we got
      if (contributions.length !== 1) {
        console.log('Contributions:', JSON.stringify(contributions, null, 2));
      }

      expect(contributions).toHaveLength(1);
      expect(contributions[0].text).toBe('New commit');
    });

    it('should filter by base branches', async () => {
      mockGitlab.Users.showCurrentUser.mockResolvedValue({
        id: 123,
        username: 'testuser',
      });

      mockGitlab.Users.allEvents.mockResolvedValue([
        {
          id: 1,
          action_name: 'pushed to',
          created_at: '2025-01-15T10:00:00Z',
          project_id: 456,
          push_data: {
            ref: 'refs/heads/main', // Base branch
            commit_title: 'Main commit',
          },
        },
        {
          id: 2,
          action_name: 'pushed to',
          created_at: '2025-01-15T11:00:00Z',
          project_id: 456,
          push_data: {
            ref: 'refs/heads/feature', // Feature branch
            commit_title: 'Feature commit',
          },
        },
      ]);

      mockGitlab.MergeRequests.all.mockResolvedValue([]);
      mockGitlab.Projects.show.mockResolvedValue({
        id: 456,
        path_with_namespace: 'test/repo',
      });

      const contributions = await connector.fetchContributions(from, to);

      expect(contributions).toHaveLength(1);
      expect(contributions[0].text).toBe('Main commit');
      expect(contributions[0].target).toBe('main');
    });

    it('should deduplicate contributions', async () => {
      mockGitlab.Users.showCurrentUser.mockResolvedValue({
        id: 123,
        username: 'testuser',
      });

      // Return duplicate events
      mockGitlab.Users.allEvents.mockResolvedValue([
        {
          id: 1,
          action_name: 'pushed to',
          created_at: '2025-01-15T10:00:00Z',
          project_id: 456,
          push_data: {
            ref: 'refs/heads/main',
            commit_title: 'Add feature',
          },
        },
        {
          id: 2,
          action_name: 'pushed to',
          created_at: '2025-01-15T10:00:00Z',
          project_id: 456,
          push_data: {
            ref: 'refs/heads/main',
            commit_title: 'Add feature',
          },
        },
      ]);

      mockGitlab.MergeRequests.all.mockResolvedValue([]);
      mockGitlab.Projects.show.mockResolvedValue({
        id: 456,
        path_with_namespace: 'test/repo',
      });

      const contributions = await connector.fetchContributions(from, to);

      expect(contributions).toHaveLength(1);
    });

    it('should handle API errors gracefully', async () => {
      mockGitlab.Users.showCurrentUser.mockResolvedValue({
        id: 123,
        username: 'testuser',
      });

      mockGitlab.Users.allEvents.mockRejectedValue(new Error('API error'));
      mockGitlab.MergeRequests.all.mockRejectedValue(new Error('API error'));

      const contributions = await connector.fetchContributions(from, to);

      expect(contributions).toHaveLength(0);
    });
  });

  describe('createGitLabConnector', () => {
    it('should throw when token is undefined', () => {
      expect(() => createGitLabConnector(undefined)).toThrow(
        'GITLAB_TOKEN environment variable is missing',
      );
    });

    it('should throw when token is empty', () => {
      expect(() => createGitLabConnector('')).toThrow(
        'A non-empty GitLab token string is required.',
      );
    });

    it('should create connector with valid token', () => {
      const connector = createGitLabConnector('valid-token');
      expect(connector).toBeInstanceOf(GitLabConnector);
    });

    it('should use provided configuration', () => {
      const customConfig = { baseBranches: ['trunk'] };
      const connector = createGitLabConnector('valid-token', customConfig);
      expect(connector).toBeInstanceOf(GitLabConnector);
    });
  });
});
