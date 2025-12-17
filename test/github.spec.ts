import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubConnector } from '../src/connectors/github.js';
import dayjs from 'dayjs';

describe('GitHubConnector', () => {
  let connector: GitHubConnector;
  const mockOctokit = {
    rest: {
      users: {
        getAuthenticated: vi.fn(),
      },
    },
    request: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    connector = new GitHubConnector('test-token');
    // @ts-expect-error - mocking private property
    connector.octokit = mockOctokit;
  });

  describe('getUserLogin', () => {
    it('should return authenticated user login', async () => {
      mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
        data: { login: 'testuser' },
      });

      const login = await connector.getUserLogin();
      expect(login).toBe('testuser');
    });
  });

  describe('fetchContributions', () => {
    const from = dayjs('2025-01-01');
    const to = dayjs('2025-01-31');

    it('should fetch and parse contributions successfully', async () => {
      mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
        data: { login: 'testuser' },
      });

      mockOctokit.request.mockResolvedValue({
        data: {
          data: {
            user: {
              contributionsCollection: {
                commitContributionsByRepository: [
                  {
                    repository: { nameWithOwner: 'test/repo' },
                    contributions: {
                      nodes: [
                        {
                          occurredAt: '2025-01-15T10:00:00Z',
                          url: 'https://github.com/test/repo/commit/abc123',
                        },
                      ],
                    },
                  },
                ],
                pullRequestContributions: {
                  nodes: [
                    {
                      occurredAt: '2025-01-16T14:30:00Z',
                      pullRequest: {
                        title: 'Add new feature',
                        url: 'https://github.com/test/repo/pull/1',
                      },
                    },
                  ],
                },
                pullRequestReviewContributions: {
                  nodes: [
                    {
                      occurredAt: '2025-01-17T09:00:00Z',
                      pullRequestReview: {
                        url: 'https://github.com/test/repo/pull/2#review',
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      });

      const contributions = await connector.fetchContributions(from, to);

      expect(contributions).toHaveLength(3);
      expect(contributions[0]).toMatchObject({
        type: 'commit',
        timestamp: '2025-01-15T10:00:00Z',
        url: 'https://github.com/test/repo/commit/abc123',
      });
      expect(contributions[1]).toMatchObject({
        type: 'pr',
        timestamp: '2025-01-16T14:30:00Z',
        text: 'Add new feature',
        url: 'https://github.com/test/repo/pull/1',
      });
      expect(contributions[2]).toMatchObject({
        type: 'review',
        timestamp: '2025-01-17T09:00:00Z',
        text: 'review',
        url: 'https://github.com/test/repo/pull/2#review',
      });
    });

    it('should throw error when GraphQL returns errors', async () => {
      mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
        data: { login: 'testuser' },
      });

      mockOctokit.request.mockResolvedValue({
        data: {
          errors: [
            {
              message: 'Rate limit exceeded',
              type: 'RATE_LIMITED',
            },
          ],
        },
      });

      await expect(connector.fetchContributions(from, to)).rejects.toThrow(
        'GraphQL API returned errors: Rate limit exceeded',
      );
    });

    it('should throw error when no data is returned', async () => {
      mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
        data: { login: 'testuser' },
      });

      mockOctokit.request.mockResolvedValue({
        data: {
          data: {},
        },
      });

      await expect(connector.fetchContributions(from, to)).rejects.toThrow(
        'No data returned from GitHub GraphQL API',
      );
    });

    it('should handle empty contributions', async () => {
      mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
        data: { login: 'testuser' },
      });

      mockOctokit.request.mockResolvedValue({
        data: {
          data: {
            user: {
              contributionsCollection: {
                commitContributionsByRepository: [],
                pullRequestContributions: { nodes: [] },
                pullRequestReviewContributions: { nodes: [] },
              },
            },
          },
        },
      });

      const contributions = await connector.fetchContributions(from, to);
      expect(contributions).toHaveLength(0);
    });
  });
});
