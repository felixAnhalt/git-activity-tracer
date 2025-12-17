import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubConnector, createGitHubConnector } from '../src/connectors/github.js';
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
    // inject the mock Octokit directly via constructor
    connector = new GitHubConnector(mockOctokit as any);
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

      // GraphQL response
      const graphqlResp = {
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
      };

      // Events response with a PushEvent to main
      const eventsResp = {
        data: [
          {
            id: '1',
            type: 'PushEvent',
            repo: { name: 'test/repo' },
            payload: {
              ref: 'refs/heads/main',
              commits: [
                {
                  sha: 'def456',
                  message: 'Hotfix',
                  url: 'https://github.com/test/repo/commit/def456',
                },
              ],
            },
            created_at: '2025-01-18T12:00:00Z',
          },
        ],
      };

      mockOctokit.request.mockResolvedValueOnce(graphqlResp).mockResolvedValueOnce(eventsResp);

      const contributions = await connector.fetchContributions(from, to);

      // Should include 4 items now (3 from GraphQL + 1 from events)
      expect(contributions).toHaveLength(4);
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

      // The event-derived commit should be present
      const eventCommit = contributions.find((c) => c.url?.includes('def456'));
      expect(eventCommit).toBeDefined();
      expect(eventCommit).toMatchObject({
        type: 'commit',
        timestamp: '2025-01-18T12:00:00Z',
        text: 'Hotfix',
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

      const graphqlResp = {
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
      };

      const eventsResp = { data: [] };

      mockOctokit.request.mockResolvedValueOnce(graphqlResp).mockResolvedValueOnce(eventsResp);

      const contributions = await connector.fetchContributions(from, to);
      expect(contributions).toHaveLength(0);
    });
  });
});
