import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import type { Contribution } from '../../types.js';
import { deduplicateContributions } from './contributionDeduplicator.js';

export interface CacheMetadata {
  platform: string;
  username: string;
  lastUpdated: string;
  contributionCount: number;
  dateRange: {
    earliest: string;
    latest: string;
  };
  scannedRanges: Array<{ from: string; to: string }>;
}

export interface CacheEntry {
  metadata: CacheMetadata;
  contributions: Contribution[];
}

export interface CacheStatus {
  exists: boolean;
  size: number;
  entries: CacheMetadata[];
}

const CACHE_DIRECTORY_NAME = '.git-activity-tracer';
const CACHE_SUBDIRECTORY_NAME = 'cache';

/**
 * Gets the cache directory path.
 */
const getCacheDirectoryPath = (): string => {
  return path.join(os.homedir(), CACHE_DIRECTORY_NAME, CACHE_SUBDIRECTORY_NAME);
};

/**
 * Gets the cache file path for a specific platform and user.
 */
const getCacheFilePath = (platform: string, username: string): string => {
  const sanitizedUsername = username.replace(/[^a-zA-Z0-9-_]/g, '_');
  const filename = `${platform}-${sanitizedUsername}.json`;
  return path.join(getCacheDirectoryPath(), filename);
};

/**
 * Ensures the cache directory exists.
 */
const ensureCacheDirectory = async (): Promise<void> => {
  const directoryPath = getCacheDirectoryPath();
  try {
    await fs.mkdir(directoryPath, { recursive: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code !== 'EEXIST') {
      throw error;
    }
  }
};

/**
 * Loads cached contributions for a specific platform and user.
 * Returns empty array if cache doesn't exist or is invalid.
 */
export const loadCache = async (platform: string, username: string): Promise<Contribution[]> => {
  const filePath = getCacheFilePath(platform, username);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const cacheEntry = JSON.parse(content) as CacheEntry;
    return cacheEntry.contributions || [];
  } catch (error) {
    // Cache doesn't exist or is invalid - return empty array
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return [];
    }
    console.warn(
      `Warning: Failed to load cache for ${platform}/${username}. Starting fresh. Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
};

/**
 * Saves contributions to cache for a specific platform and user.
 * Merges with existing cache and deduplicates.
 */
export const saveCache = async (
  platform: string,
  username: string,
  newContributions: Contribution[],
): Promise<void> => {
  await ensureCacheDirectory();

  // Load existing cache
  const existingContributions = await loadCache(platform, username);

  // Merge and deduplicate
  const allContributions = [...existingContributions, ...newContributions];
  const deduplicated = deduplicateContributions(allContributions);

  // Sort by timestamp (oldest to newest)
  const sorted = deduplicated.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  // Calculate metadata
  const metadata: CacheMetadata = {
    platform,
    username,
    lastUpdated: new Date().toISOString(),
    contributionCount: sorted.length,
    dateRange: {
      earliest: sorted.length > 0 ? sorted[0].timestamp : new Date().toISOString(),
      latest: sorted.length > 0 ? sorted[sorted.length - 1].timestamp : new Date().toISOString(),
    },
  };

  const cacheEntry: CacheEntry = {
    metadata,
    contributions: sorted,
  };

  const filePath = getCacheFilePath(platform, username);
  const content = JSON.stringify(cacheEntry, null, 2);
  await fs.writeFile(filePath, content, 'utf-8');
};

/**
 * Filters cached contributions by date range.
 */
export const filterCacheByDateRange = (
  contributions: Contribution[],
  fromDate: Date,
  toDate: Date,
): Contribution[] => {
  const fromTime = fromDate.getTime();
  const toTime = toDate.getTime();

  return contributions.filter((contribution) => {
    const contributionTime = new Date(contribution.timestamp).getTime();
    return contributionTime >= fromTime && contributionTime <= toTime;
  });
};

/**
 * Determines if cache needs refresh for a given date range.
 * Always fetches fresh data to ensure we have the latest contributions.
 * The cache is used to supplement the fresh data, not replace it.
 */
export const calculateMissingDateRange = (
  cachedContributions: Contribution[],
  requestedFrom: Date,
  requestedTo: Date,
): { needsFetch: boolean; fetchFrom?: Date; fetchTo?: Date } => {
  // Always fetch fresh data for the requested range
  // The cache will be merged with fresh data and deduplicated
  return { needsFetch: true, fetchFrom: requestedFrom, fetchTo: requestedTo };
};

/**
 * Clears all cached data.
 */
export const clearCache = async (): Promise<number> => {
  const directoryPath = getCacheDirectoryPath();

  try {
    const files = await fs.readdir(directoryPath);
    const jsonFiles = files.filter((file) => file.endsWith('.json'));

    await Promise.all(jsonFiles.map((file) => fs.unlink(path.join(directoryPath, file))));

    return jsonFiles.length;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      // Cache directory doesn't exist
      return 0;
    }
    throw error;
  }
};

/**
 * Gets cache status (metadata about all cached entries).
 */
export const getCacheStatus = async (): Promise<CacheStatus> => {
  const directoryPath = getCacheDirectoryPath();

  try {
    const files = await fs.readdir(directoryPath);
    const jsonFiles = files.filter((file) => file.endsWith('.json'));

    const entries: CacheMetadata[] = [];
    let totalSize = 0;

    for (const file of jsonFiles) {
      const filePath = path.join(directoryPath, file);
      const stats = await fs.stat(filePath);
      totalSize += stats.size;

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const cacheEntry = JSON.parse(content) as CacheEntry;
        entries.push(cacheEntry.metadata);
      } catch {
        // Skip invalid cache files
        continue;
      }
    }

    return {
      exists: entries.length > 0,
      size: totalSize,
      entries,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return { exists: false, size: 0, entries: [] };
    }
    throw error;
  }
};
