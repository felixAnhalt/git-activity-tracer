import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubConnector, createGitHubConnector } from '../../src/connectors/github.js';
import dayjs from 'dayjs';
import type { Octokit } from '@octokit/rest';

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
    connector = new GitHubConnector(mockOctokit as unknown as Octokit);
  });

  it('constructor should throw when constructed without token or Octokit', () => {
    // @ts-expect-error runtime test
    expect(() => new GitHubConnector(undefined)).toThrow(
      'Octokit instance or token string is required.',
    );
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
                    repository: {
                      nameWithOwner: 'test/repo',
                      defaultBranchRef: {
                        name: 'main',
                        target: {
                          history: {
                            nodes: [
                              {
                                oid: 'abc123',
                                committedDate: '2025-01-15T10:00:00Z',
                                messageHeadline: 'Add feature',
                                message: 'Add feature\n\nDetailed description',
                                url: 'https://github.com/test/repo/commit/abc123',
                                author: {
                                  name: 'Test User',
                                  email: 'test@example.com',
                                  user: { login: 'testuser' },
                                },
                              },
                            ],
                            pageInfo: {
                              hasNextPage: false,
                              endCursor: null,
                            },
                          },
                        },
                      },
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

      // Events API is no longer used for commits
      mockOctokit.request.mockResolvedValueOnce(graphqlResp);

      const contributions = await connector.fetchContributions(from, to);

      // Should include 3 items from GraphQL (commit, PR, review)
      // Events API commits are no longer included to avoid false positives
      expect(contributions).toHaveLength(3);

      expect(contributions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'commit',
            timestamp: '2025-01-15T10:00:00Z',
            text: 'Add feature',
            url: 'https://github.com/test/repo/commit/abc123',
          }),
          expect.objectContaining({
            type: 'pr',
            timestamp: '2025-01-16T14:30:00Z',
            text: 'Add new feature',
            url: 'https://github.com/test/repo/pull/1',
          }),
          expect.objectContaining({
            type: 'review',
            timestamp: '2025-01-17T09:00:00Z',
            text: 'review',
            url: 'https://github.com/test/repo/pull/2#review',
          }),
        ]),
      );
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

      mockOctokit.request.mockResolvedValueOnce(graphqlResp);

      const contributions = await connector.fetchContributions(from, to);
      expect(contributions).toHaveLength(0);
    });

    it('should filter out commits by other authors', async () => {
      mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
        data: { login: 'testuser' },
      });

      // GraphQL response with commits by different authors
      const graphqlResp = {
        data: {
          data: {
            user: {
              contributionsCollection: {
                commitContributionsByRepository: [
                  {
                    repository: {
                      nameWithOwner: 'test/repo',
                      defaultBranchRef: {
                        name: 'main',
                        target: {
                          history: {
                            nodes: [
                              {
                                oid: 'abc123',
                                committedDate: '2025-01-15T10:00:00Z',
                                messageHeadline: 'My commit',
                                message: 'My commit\n\nBy testuser',
                                url: 'https://github.com/test/repo/commit/abc123',
                                author: {
                                  name: 'Test User',
                                  email: 'test@example.com',
                                  user: { login: 'testuser' },
                                },
                              },
                              {
                                oid: 'def456',
                                committedDate: '2025-01-16T10:00:00Z',
                                messageHeadline: 'Someone elses commit',
                                message: 'Someone elses commit\n\nBy otheruser',
                                url: 'https://github.com/test/repo/commit/def456',
                                author: {
                                  name: 'Other User',
                                  email: 'other@example.com',
                                  user: { login: 'otheruser' },
                                },
                              },
                              {
                                oid: 'ghi789',
                                committedDate: '2025-01-17T10:00:00Z',
                                messageHeadline: 'Another commit by me',
                                message: 'Another commit by me\n\nBy testuser',
                                url: 'https://github.com/test/repo/commit/ghi789',
                                author: {
                                  name: 'Test User',
                                  email: 'test@example.com',
                                  user: { login: 'testuser' },
                                },
                              },
                            ],
                            pageInfo: {
                              hasNextPage: false,
                              endCursor: null,
                            },
                          },
                        },
                      },
                    },
                  },
                ],
                pullRequestContributions: {
                  nodes: [],
                },
                pullRequestReviewContributions: {
                  nodes: [],
                },
              },
            },
          },
        },
      };

      mockOctokit.request.mockResolvedValueOnce(graphqlResp);

      const contributions = await connector.fetchContributions(from, to);

      // Should only include 2 commits by testuser, not the one by otheruser
      expect(contributions).toHaveLength(2);
      expect(contributions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'commit',
            text: 'My commit',
            url: 'https://github.com/test/repo/commit/abc123',
          }),
          expect.objectContaining({
            type: 'commit',
            text: 'Another commit by me',
            url: 'https://github.com/test/repo/commit/ghi789',
          }),
        ]),
      );

      // Should NOT include the commit by otheruser
      const otherUserCommit = contributions.find((c) => c.url?.includes('def456'));
      expect(otherUserCommit).toBeUndefined();
    });
  });

  describe('createGitHubConnector', () => {
    it('should throw when token is missing', () => {
      expect(() => createGitHubConnector(undefined)).toThrow(
        'GH_TOKEN environment variable is missing',
      );
    });

    it('should throw when token is empty string', () => {
      expect(() => createGitHubConnector('')).toThrow(
        'A non-empty GitHub token string is required',
      );
    });

    it('should create connector when valid token is provided', () => {
      const connector = createGitHubConnector('valid-token');
      expect(connector).toBeInstanceOf(GitHubConnector);
    });
  });
});
