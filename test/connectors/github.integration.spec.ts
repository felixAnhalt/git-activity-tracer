import { describe, it, expect, beforeAll } from 'vitest';
import { createGitHubConnector } from '../../src/connectors/github.js';
import dayjs from 'dayjs';

/**
 * Integration test for the GitHub Activity Tracer CLI
 *
 * This test makes REAL API calls to GitHub.
 *
 * Prerequisites:
 * - Set GH_TOKEN environment variable with a valid GitHub Personal Access Token
 * - Token needs read:user and repo scopes
 *
 * To run: GH_TOKEN=your_token pnpm test -- test/index.spec.ts
 * To debug: Add breakpoints and run with your debugger
 */

const API_TEST_TIMEOUT = 30000; // 30 seconds for API calls

describe.skipIf(!process.env.GH_TOKEN)('GitHub Activity Integration Test', () => {
  const token = process.env.GH_TOKEN;

  beforeAll(() => {
    if (!token) {
      throw new Error(
        'GH_TOKEN environment variable is required for integration tests. ' +
          'Create a token at https://github.com/settings/tokens',
      );
    }
    console.log('\n🔐 Using GitHub token from environment');
  });

  it(
    'should fetch real contributions for a specific date range',
    async () => {
      const fromDate = dayjs('2025-01-01');
      const toDate = dayjs('2025-02-02');
      console.log(
        `\n📅 Testing date range: ${fromDate.format('YYYY-MM-DD')} to ${toDate.format('YYYY-MM-DD')}`,
      );

      const connector = createGitHubConnector(token);

      // Get authenticated user
      console.log('🔍 Fetching authenticated user...');
      const login = await connector.getUserLogin();
      console.log(`✅ Authenticated as: ${login}`);

      console.log(
        `\n📊 Fetching contributions from ${fromDate.format('YYYY-MM-DD')} to ${toDate.format('YYYY-MM-DD')}...`,
      );
      console.log('⏳ This may take a few seconds...\n');

      // Fetch contributions
      const startTime = Date.now();
      const contributions = await connector.fetchContributions(fromDate, toDate);
      const duration = Date.now() - startTime;

      console.log(`✅ Fetch completed in ${duration}ms`);
      console.log(`📈 Total contributions found: ${contributions.length}\n`);

      // Log contribution breakdown
      const contributionsByType = contributions.reduce(
        (accumulator, contribution) => {
          accumulator[contribution.type] = (accumulator[contribution.type] || 0) + 1;
          return accumulator;
        },
        {} as Record<string, number>,
      );

      console.log('📋 Contribution breakdown:');
      for (const [type, count] of Object.entries(contributionsByType)) {
        console.log(`  - ${type}: ${count}`);
      }

      // Log sample contributions
      if (contributions.length > 0) {
        console.log('\n🔍 Sample contributions (first 5):');
        contributions.slice(0, 5).forEach((contribution, index) => {
          console.log(`\n  [${index + 1}] ${contribution.type.toUpperCase()}`);
          console.log(`      Timestamp: ${contribution.timestamp}`);
          if (contribution.text) {
            console.log(`      Text: ${contribution.text}`);
          }
          if (contribution.url) {
            console.log(`      URL: ${contribution.url}`);
          }
        });
      }

      // Assertions
      expect(Array.isArray(contributions)).toBe(true);
      expect(login).toBeTruthy();
      expect(typeof login).toBe('string');

      // Each contribution should have required fields
      contributions.forEach((contribution) => {
        expect(contribution).toHaveProperty('type');
        expect(contribution).toHaveProperty('timestamp');
        expect(['commit', 'pr', 'review']).toContain(contribution.type);
        expect(typeof contribution.timestamp).toBe('string');

        // Timestamp should be valid ISO date
        const timestamp = new Date(contribution.timestamp);
        expect(timestamp.toString()).not.toBe('Invalid Date');
        expect(Number.isNaN(timestamp.getTime())).toBe(false);

        // URL should be valid GitHub URL if present
        if (contribution.url) {
          expect(contribution.url).toMatch(/^https:\/\/github\.com\//);
        }
      });

      console.log('\n✅ All assertions passed!');
    },
    API_TEST_TIMEOUT,
  );

  it(
    'should handle empty date ranges gracefully',
    async () => {
      console.log('\n📅 Testing empty date range (future dates)');

      const connector = createGitHubConnector(token);

      // Use future dates where there likely won't be contributions
      const fromDate = dayjs('2099-01-01');
      const toDate = dayjs('2099-01-02');

      console.log(
        `📊 Fetching contributions from ${fromDate.format('YYYY-MM-DD')} to ${toDate.format('YYYY-MM-DD')}...`,
      );

      const contributions = await connector.fetchContributions(fromDate, toDate);

      console.log(`📈 Total contributions found: ${contributions.length}`);

      expect(Array.isArray(contributions)).toBe(true);
      console.log('✅ Empty range handled correctly!');
    },
    API_TEST_TIMEOUT,
  );

  it(
    'should deduplicate contributions correctly',
    async () => {
      console.log('\n📅 Testing deduplication');

      const connector = createGitHubConnector(token);

      const fromDate = dayjs('2025-01-01');
      const toDate = dayjs('2025-02-02');

      console.log(
        `📊 Fetching contributions from ${fromDate.format('YYYY-MM-DD')} to ${toDate.format('YYYY-MM-DD')}...`,
      );

      const contributions = await connector.fetchContributions(fromDate, toDate);

      console.log(`📈 Total contributions: ${contributions.length}`);

      // Check for duplicates by creating composite keys
      const contributionKeys = new Set<string>();
      let duplicateCount = 0;

      contributions.forEach((contribution) => {
        const key = `${contribution.type}|${contribution.timestamp}|${contribution.url ?? ''}|${contribution.text ?? ''}`;
        if (contributionKeys.has(key)) {
          duplicateCount++;
          console.log(`⚠️  Found duplicate: ${key}`);
        }
        contributionKeys.add(key);
      });

      console.log(`🔍 Duplicate count: ${duplicateCount}`);
      expect(duplicateCount).toBe(0);
      console.log('✅ No duplicates found!');
    },
    API_TEST_TIMEOUT,
  );
});
