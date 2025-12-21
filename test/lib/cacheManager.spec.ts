import { describe, it, expect, afterEach } from 'vitest';
import {
  loadCache,
  saveCache,
  clearCache,
  getCacheStatus,
  filterCacheByDateRange,
  calculateMissingDateRange,
} from '../../src/lib/services/cacheManager.js';
import type { Contribution } from '../../src/types.js';

/**
 * Unit tests for cache manager service
 *
 * Tests caching functionality including:
 * - Save and load cache
 * - Merge and deduplicate contributions
 * - Filter by date range
 * - Calculate missing date ranges
 * - Clear cache
 * - Get cache status
 */

describe('Cache Manager', () => {
  const testPlatform = 'github';
  const testUsername = 'test-user';

  // Clean up after each test
  afterEach(async () => {
    try {
      await clearCache();
    } catch {
      // Ignore errors
    }
  });

  describe('loadCache and saveCache', () => {
    it('should return empty array when cache does not exist', async () => {
      const contributions = await loadCache(testPlatform, testUsername);
      expect(contributions).toEqual([]);
    });

    it('should save and load contributions', async () => {
      const contributions: Contribution[] = [
        {
          type: 'commit',
          timestamp: '2025-01-01T10:00:00Z',
          text: 'Initial commit',
          repository: 'owner/repo',
          url: 'https://github.com/owner/repo/commit/abc123',
        },
        {
          type: 'pr',
          timestamp: '2025-01-02T11:00:00Z',
          text: 'Add feature',
          repository: 'owner/repo',
          url: 'https://github.com/owner/repo/pull/1',
        },
      ];

      await saveCache(testPlatform, testUsername, contributions);
      const loaded = await loadCache(testPlatform, testUsername);

      expect(loaded).toHaveLength(2);
      expect(loaded[0].type).toBe('commit');
      expect(loaded[1].type).toBe('pr');
    });

    it('should merge and deduplicate when saving to existing cache', async () => {
      const firstBatch: Contribution[] = [
        {
          type: 'commit',
          timestamp: '2025-01-01T10:00:00Z',
          text: 'First commit',
          url: 'https://github.com/owner/repo/commit/abc123',
        },
      ];

      const secondBatch: Contribution[] = [
        {
          type: 'commit',
          timestamp: '2025-01-01T10:00:00Z',
          text: 'First commit',
          url: 'https://github.com/owner/repo/commit/abc123', // Duplicate
        },
        {
          type: 'commit',
          timestamp: '2025-01-02T10:00:00Z',
          text: 'Second commit',
          url: 'https://github.com/owner/repo/commit/def456',
        },
      ];

      await saveCache(testPlatform, testUsername, firstBatch);
      await saveCache(testPlatform, testUsername, secondBatch);

      const loaded = await loadCache(testPlatform, testUsername);
      expect(loaded).toHaveLength(2); // Deduplicated
    });

    it('should sort contributions by timestamp (oldest first) when saving', async () => {
      const contributions: Contribution[] = [
        {
          type: 'commit',
          timestamp: '2025-01-03T10:00:00Z',
          text: 'Third',
        },
        {
          type: 'commit',
          timestamp: '2025-01-01T10:00:00Z',
          text: 'First',
        },
        {
          type: 'commit',
          timestamp: '2025-01-02T10:00:00Z',
          text: 'Second',
        },
      ];

      await saveCache(testPlatform, testUsername, contributions);
      const loaded = await loadCache(testPlatform, testUsername);

      expect(loaded[0].text).toBe('First');
      expect(loaded[1].text).toBe('Second');
      expect(loaded[2].text).toBe('Third');
    });

    it('should handle cache files with sanitized usernames', async () => {
      const specialUsername = 'user@example.com';
      const contributions: Contribution[] = [
        {
          type: 'commit',
          timestamp: '2025-01-01T10:00:00Z',
          text: 'Test',
        },
      ];

      await saveCache(testPlatform, specialUsername, contributions);
      const loaded = await loadCache(testPlatform, specialUsername);

      expect(loaded).toHaveLength(1);
    });
  });

  describe('filterCacheByDateRange', () => {
    const contributions: Contribution[] = [
      {
        type: 'commit',
        timestamp: '2025-01-01T10:00:00Z',
        text: 'Jan 1',
      },
      {
        type: 'commit',
        timestamp: '2025-01-05T10:00:00Z',
        text: 'Jan 5',
      },
      {
        type: 'commit',
        timestamp: '2025-01-10T10:00:00Z',
        text: 'Jan 10',
      },
      {
        type: 'commit',
        timestamp: '2025-01-15T10:00:00Z',
        text: 'Jan 15',
      },
    ];

    it('should filter contributions within date range', () => {
      const from = new Date('2025-01-05T00:00:00Z');
      const to = new Date('2025-01-10T23:59:59Z');

      const filtered = filterCacheByDateRange(contributions, from, to);

      expect(filtered).toHaveLength(2);
      expect(filtered[0].text).toBe('Jan 5');
      expect(filtered[1].text).toBe('Jan 10');
    });

    it('should include contributions on boundary dates', () => {
      const from = new Date('2025-01-01T00:00:00Z');
      const to = new Date('2025-01-15T23:59:59Z');

      const filtered = filterCacheByDateRange(contributions, from, to);

      expect(filtered).toHaveLength(4);
    });

    it('should return empty array when no contributions in range', () => {
      const from = new Date('2025-02-01');
      const to = new Date('2025-02-28');

      const filtered = filterCacheByDateRange(contributions, from, to);

      expect(filtered).toHaveLength(0);
    });
  });

  describe('calculateMissingDateRange', () => {
    it('should indicate full fetch when cache is empty', () => {
      const emptyCache: Contribution[] = [];
      const from = new Date('2025-01-01');
      const to = new Date('2025-01-31');

      const result = calculateMissingDateRange(emptyCache, from, to);

      expect(result.needsFetch).toBe(true);
      expect(result.fetchFrom).toEqual(from);
      expect(result.fetchTo).toEqual(to);
    });

    it('should always indicate fetch is needed', () => {
      const cache: Contribution[] = [
        {
          type: 'commit',
          timestamp: '2025-01-01T00:00:00Z',
          text: 'Start',
        },
        {
          type: 'commit',
          timestamp: '2025-01-31T23:59:59Z',
          text: 'End',
        },
      ];

      const from = new Date('2025-01-10');
      const to = new Date('2025-01-20');

      const result = calculateMissingDateRange(cache, from, to);

      // Cache strategy: always fetch fresh data for the requested range
      // The cache will be merged with fresh data later
      expect(result.needsFetch).toBe(true);
      expect(result.fetchFrom).toEqual(from);
      expect(result.fetchTo).toEqual(to);
    });

    it('should always fetch the full requested range', () => {
      const cache: Contribution[] = [
        {
          type: 'commit',
          timestamp: '2025-01-01T00:00:00Z',
          text: 'Old',
        },
        {
          type: 'commit',
          timestamp: '2025-01-15T00:00:00Z',
          text: 'Recent',
        },
      ];

      const from = new Date('2025-01-01');
      const to = new Date('2025-01-31');

      const result = calculateMissingDateRange(cache, from, to);

      expect(result.needsFetch).toBe(true);
      expect(result.fetchFrom).toEqual(from);
      expect(result.fetchTo).toEqual(to);
    });

    it('should handle requested range before cache', () => {
      const cache: Contribution[] = [
        {
          type: 'commit',
          timestamp: '2025-02-01T00:00:00Z',
          text: 'Feb',
        },
      ];

      const from = new Date('2025-01-01');
      const to = new Date('2025-01-15');

      const result = calculateMissingDateRange(cache, from, to);

      expect(result.needsFetch).toBe(true);
    });
  });

  describe('clearCache', () => {
    it('should return 0 when cache is empty', async () => {
      const count = await clearCache();
      expect(count).toBe(0);
    });

    it('should clear all cache files and return count', async () => {
      // Create multiple cache files
      const contributions: Contribution[] = [
        {
          type: 'commit',
          timestamp: '2025-01-01T10:00:00Z',
          text: 'Test',
        },
      ];

      await saveCache('github', 'user1', contributions);
      await saveCache('gitlab', 'user2', contributions);

      const count = await clearCache();
      expect(count).toBe(2);

      // Verify cache is empty
      const status = await getCacheStatus();
      expect(status.exists).toBe(false);
    });
  });

  describe('getCacheStatus', () => {
    it('should return empty status when cache does not exist', async () => {
      const status = await getCacheStatus();

      expect(status.exists).toBe(false);
      expect(status.size).toBe(0);
      expect(status.entries).toHaveLength(0);
    });

    it('should return cache status with metadata', async () => {
      const contributions: Contribution[] = [
        {
          type: 'commit',
          timestamp: '2025-01-01T10:00:00Z',
          text: 'First',
        },
        {
          type: 'commit',
          timestamp: '2025-01-15T10:00:00Z',
          text: 'Last',
        },
      ];

      await saveCache(testPlatform, testUsername, contributions);
      const status = await getCacheStatus();

      expect(status.exists).toBe(true);
      expect(status.size).toBeGreaterThan(0);
      expect(status.entries).toHaveLength(1);
      expect(status.entries[0].platform).toBe(testPlatform);
      expect(status.entries[0].username).toBe(testUsername);
      expect(status.entries[0].contributionCount).toBe(2);
      expect(status.entries[0].dateRange.earliest).toBe('2025-01-01T10:00:00Z');
      expect(status.entries[0].dateRange.latest).toBe('2025-01-15T10:00:00Z');
    });

    it('should return status for multiple cache entries', async () => {
      const contributions: Contribution[] = [
        {
          type: 'commit',
          timestamp: '2025-01-01T10:00:00Z',
          text: 'Test',
        },
      ];

      await saveCache('github', 'user1', contributions);
      await saveCache('gitlab', 'user2', contributions);

      const status = await getCacheStatus();

      expect(status.exists).toBe(true);
      expect(status.entries).toHaveLength(2);
    });
  });
});
