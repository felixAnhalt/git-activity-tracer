import { describe, it, expect, beforeAll } from 'vitest';
import { generateReport } from '../../src/lib/services/reportGenerator.js';
import { createGitHubConnector } from '../../src/connectors/github.js';
import { createGitLabConnector } from '../../src/connectors/gitlab.js';
import type { Connector } from '../../src/connectors/types.js';
import type { Configuration } from '../../src/lib/config/index.js';
import dayjs from 'dayjs';

/**
 * Integration tests for report generator service
 *
 * Tests the complete report generation workflow including:
 * - Multi-platform fetching (GitHub + GitLab)
 * - Contribution deduplication
 * - Project ID enrichment
 * - Sorting by timestamp
 *
 * Prerequisites:
 * - Set GH_TOKEN and GITLAB_TOKEN for multi-platform tests
 * - At least one token required for basic tests
 *
 * Note: Handles weeks with no commits gracefully.
 */

const API_TEST_TIMEOUT = 60000; // 60 seconds

describe.skipIf(!process.env.GH_TOKEN && !process.env.GITLAB_TOKEN)(
  'Report Generator Integration',
  () => {
    beforeAll(() => {
      if (!process.env.GH_TOKEN && !process.env.GITLAB_TOKEN) {
        throw new Error('At least one token required for integration tests');
      }
      console.log('\n🔐 Using tokens from environment');
    });

    it(
      'should generate report with single connector',
      async () => {
        console.log('\n📊 Testing single connector report generation');

        const connectors: Connector[] = [];
        const configuration: Configuration = {
          baseBranches: ['main', 'master'],
          repositoryProjectIds: {},
        };

        // Use whichever token is available
        if (process.env.GH_TOKEN) {
          connectors.push(createGitHubConnector(process.env.GH_TOKEN));
          console.log('✓ GitHub connector initialized');
        } else if (process.env.GITLAB_TOKEN) {
          connectors.push(createGitLabConnector(process.env.GITLAB_TOKEN, configuration));
          console.log('✓ GitLab connector initialized');
        }

        const fromDate = dayjs('2025-01-01');
        const toDate = dayjs('2025-01-07');

        const contributions = await generateReport(connectors, configuration, fromDate, toDate);

        expect(Array.isArray(contributions)).toBe(true);
        console.log(`📈 Total contributions: ${contributions.length}`);

        // Verify all contributions have required fields
        contributions.forEach((contribution) => {
          expect(contribution).toHaveProperty('type');
          expect(contribution).toHaveProperty('timestamp');
        });

        // Verify sorting (newest first)
        if (contributions.length > 1) {
          for (let index = 0; index < contributions.length - 1; index++) {
            const current = new Date(contributions[index].timestamp).getTime();
            const next = new Date(contributions[index + 1].timestamp).getTime();
            expect(current).toBeGreaterThanOrEqual(next);
          }
          console.log('✓ Contributions sorted correctly (newest first)');
        }

        if (contributions.length === 0) {
          console.log('ℹ️  No contributions in this period (expected for some weeks)');
        }

        console.log('✅ Single connector report generated successfully');
      },
      API_TEST_TIMEOUT,
    );

    it.skipIf(!process.env.GH_TOKEN || !process.env.GITLAB_TOKEN)(
      'should fetch and merge contributions from multiple platforms',
      async () => {
        console.log('\n🌍 Testing multi-platform report generation');

        const configuration: Configuration = {
          baseBranches: ['main', 'master'],
          repositoryProjectIds: {},
        };

        const connectors: Connector[] = [
          createGitHubConnector(process.env.GH_TOKEN!),
          createGitLabConnector(process.env.GITLAB_TOKEN!, configuration),
        ];

        console.log('✓ GitHub connector initialized');
        console.log('✓ GitLab connector initialized');

        const fromDate = dayjs('2025-01-01');
        const toDate = dayjs('2025-02-02');

        const contributions = await generateReport(connectors, configuration, fromDate, toDate);

        expect(Array.isArray(contributions)).toBe(true);
        console.log(`📈 Total merged contributions: ${contributions.length}`);

        // Check for contributions from different platforms
        const platforms = new Set(
          contributions
            .map((contribution) => {
              if (contribution.url?.includes('github.com')) return 'GitHub';
              if (contribution.url?.includes('gitlab.com')) return 'GitLab';
              return 'Unknown';
            })
            .filter((platform) => platform !== 'Unknown'),
        );

        console.log(`📋 Platforms detected: ${Array.from(platforms).join(', ')}`);

        if (contributions.length > 0) {
          // Verify no duplicates
          const contributionKeys = new Set<string>();
          let duplicateCount = 0;

          contributions.forEach((contribution) => {
            const key = `${contribution.type}|${contribution.timestamp}|${contribution.url ?? ''}|${contribution.text ?? ''}`;
            if (contributionKeys.has(key)) {
              duplicateCount++;
            }
            contributionKeys.add(key);
          });

          expect(duplicateCount).toBe(0);
          console.log('✓ No duplicate contributions detected');

          // Verify sorting
          if (contributions.length > 1) {
            for (let index = 0; index < contributions.length - 1; index++) {
              const current = new Date(contributions[index].timestamp).getTime();
              const next = new Date(contributions[index + 1].timestamp).getTime();
              expect(current).toBeGreaterThanOrEqual(next);
            }
            console.log('✓ Multi-platform contributions sorted correctly');
          }
        } else {
          console.log('ℹ️  No contributions found (expected for some periods)');
        }

        console.log('✅ Multi-platform report generated successfully');
      },
      API_TEST_TIMEOUT,
    );

    it(
      'should enrich contributions with project IDs',
      async () => {
        console.log('\n🏷️  Testing project ID enrichment');

        const configuration: Configuration = {
          baseBranches: ['main', 'master'],
          repositoryProjectIds: {
            'test-org/test-repository': 'PROJECT-123',
            'another-org/another-repository': 'PROJECT-456',
          },
        };

        const connectors: Connector[] = [];
        if (process.env.GH_TOKEN) {
          connectors.push(createGitHubConnector(process.env.GH_TOKEN));
        } else if (process.env.GITLAB_TOKEN) {
          connectors.push(createGitLabConnector(process.env.GITLAB_TOKEN, configuration));
        }

        const fromDate = dayjs('2025-01-01');
        const toDate = dayjs('2025-01-07');

        const contributions = await generateReport(connectors, configuration, fromDate, toDate);

        console.log(`📈 Total contributions: ${contributions.length}`);

        // Check if any contributions were enriched with project IDs
        const enrichedContributions = contributions.filter(
          (contribution) => contribution.projectId !== undefined,
        );

        console.log(`🏷️  Enriched contributions: ${enrichedContributions.length}`);

        if (enrichedContributions.length > 0) {
          enrichedContributions.forEach((contribution) => {
            expect(contribution.projectId).toBeTruthy();
            console.log(`  ✓ ${contribution.repository ?? 'unknown'} → ${contribution.projectId}`);
          });
        } else {
          console.log(
            'ℹ️  No contributions matched configured repositories (expected in most cases)',
          );
        }

        console.log('✅ Project ID enrichment test completed');
      },
      API_TEST_TIMEOUT,
    );

    it(
      'should handle empty date ranges gracefully',
      async () => {
        console.log('\n📅 Testing empty date range handling in report generator');

        const configuration: Configuration = {
          baseBranches: ['main', 'master'],
          repositoryProjectIds: {},
        };

        const connectors: Connector[] = [];
        if (process.env.GH_TOKEN) {
          connectors.push(createGitHubConnector(process.env.GH_TOKEN));
        } else if (process.env.GITLAB_TOKEN) {
          connectors.push(createGitLabConnector(process.env.GITLAB_TOKEN, configuration));
        }

        const fromDate = dayjs('2099-01-01');
        const toDate = dayjs('2099-01-07');

        const contributions = await generateReport(connectors, configuration, fromDate, toDate);

        expect(Array.isArray(contributions)).toBe(true);
        expect(contributions.length).toBe(0);

        console.log('✅ Empty date range handled correctly');
      },
      API_TEST_TIMEOUT,
    );

    it.skipIf(!process.env.GH_TOKEN || !process.env.GITLAB_TOKEN)(
      'should handle connector failures gracefully',
      async () => {
        console.log('\n⚠️  Testing partial connector failure handling');

        const configuration: Configuration = {
          baseBranches: ['main', 'master'],
          repositoryProjectIds: {},
        };

        // Create one valid connector and simulate a failing connector
        const validConnector = createGitHubConnector(process.env.GH_TOKEN!);

        // Create a failing connector by using an invalid token
        const failingConnector = createGitLabConnector('invalid-token', configuration);

        const connectors: Connector[] = [validConnector, failingConnector];

        const fromDate = dayjs('2025-01-01');
        const toDate = dayjs('2025-01-07');

        // Should not throw - should handle the failure gracefully
        const contributions = await generateReport(connectors, configuration, fromDate, toDate);

        expect(Array.isArray(contributions)).toBe(true);
        console.log(
          `📈 Contributions from working connector: ${contributions.length} (despite one failure)`,
        );

        console.log('✅ Partial failure handled gracefully');
      },
      API_TEST_TIMEOUT,
    );
  },
);
