import { clearCache, getCacheStatus } from '../../lib/services/cacheManager.js';

/**
 * Handles cache management commands.
 * Supports: status, clear
 */
export const handleCacheCommand = async (arguments_: string[]): Promise<void> => {
  const subcommand = arguments_[0];

  if (!subcommand || subcommand === 'status') {
    await handleCacheStatus();
    return;
  }

  if (subcommand === 'clear') {
    await handleCacheClear();
    return;
  }

  console.error(`Unknown cache subcommand: ${subcommand}`);
  console.log('\nAvailable commands:');
  console.log('  cache status  - Show cache information');
  console.log('  cache clear   - Clear all cached data');
  process.exit(1);
};

/**
 * Shows cache status (size, entries, date ranges).
 */
const handleCacheStatus = async (): Promise<void> => {
  const status = await getCacheStatus();

  if (!status.exists) {
    console.log('Cache is empty');
    return;
  }

  console.log('Cache Status:');
  console.log(`  Total size: ${formatBytes(status.size)}`);
  console.log(`  Total entries: ${status.entries.length}`);
  console.log('');

  if (status.entries.length > 0) {
    console.log('Cached data:');
    for (const entry of status.entries) {
      console.log(`  ${entry.platform}/${entry.username}`);
      console.log(`    Contributions: ${entry.contributionCount}`);
      console.log(
        `    Date range: ${formatDate(entry.dateRange.earliest)} to ${formatDate(entry.dateRange.latest)}`,
      );
      console.log(`    Last updated: ${formatDate(entry.lastUpdated)}`);
      console.log('');
    }
  }
};

/**
 * Clears all cached data.
 */
const handleCacheClear = async (): Promise<void> => {
  const clearedCount = await clearCache();

  if (clearedCount === 0) {
    console.log('Cache is already empty');
  } else {
    console.log(`✓ Cleared ${clearedCount} cache ${clearedCount === 1 ? 'file' : 'files'}`);
  }
};

/**
 * Formats bytes to human-readable string.
 */
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
};

/**
 * Formats ISO date string to readable format.
 */
const formatDate = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toISOString().split('T')[0];
};
