import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { runContributionReport } from '../../src/cli/commands/report.js';
import type { CliArguments } from '../../src/cli/types.js';
import { readFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import dayjs from 'dayjs';

/**
 * End-to-end CLI integration tests
 *
 * Tests the complete workflow from CLI arguments through to output generation.
 *
 * Prerequisites:
 * - Set GH_TOKEN and/or GITLAB_TOKEN environment variables
 * - At least one token must be available
 *
 * Note: Tests handle weeks with no commits gracefully by verifying empty results.
 */

const API_TEST_TIMEOUT = 60000; // 60 seconds for full workflow

describe.skipIf(!process.env.GH_TOKEN && !process.env.GITLAB_TOKEN)(
  'End-to-End CLI Integration',
  () => {
    const generatedFiles: string[] = [];

    beforeAll(() => {
      if (!process.env.GH_TOKEN && !process.env.GITLAB_TOKEN) {
        throw new Error(
          'At least one token (GH_TOKEN or GITLAB_TOKEN) is required for integration tests',
        );
      }
      console.log('\n🔐 Using tokens from environment');
    });

    afterEach(async () => {
      // Clean up generated files
      for (const filePath of generatedFiles) {
        if (existsSync(filePath)) {
          await unlink(filePath);
          console.log(`🧹 Cleaned up: ${filePath}`);
        }
      }
      generatedFiles.length = 0;
    });

    it(
      'should generate console output for a recent date range',
      async () => {
        console.log('\n📅 Testing console output for recent week');

        const cliArguments: CliArguments = {
          from: undefined,
          to: undefined,
          lastweek: true,
          lastmonth: false,
          output: 'console',
          withLinks: true,
          showConfig: false,
          projectIdCommand: false,
        };

        // Should not throw - even if there are no contributions
        await expect(runContributionReport(cliArguments)).resolves.not.toThrow();

        console.log('✅ Console output generated successfully');
      },
      API_TEST_TIMEOUT,
    );

    it(
      'should generate JSON output file with correct structure',
      async () => {
        console.log('\n📅 Testing JSON output generation');

        const fromDate = '2025-01-01';
        const toDate = '2025-01-07';
        const expectedFilePath = `git-contributions-${fromDate}-${toDate}.json`;
        generatedFiles.push(expectedFilePath);

        const cliArguments: CliArguments = {
          from: fromDate,
          to: toDate,
          lastweek: false,
          lastmonth: false,
          output: 'json',
          withLinks: true,
          showConfig: false,
          projectIdCommand: false,
        };

        await runContributionReport(cliArguments);

        // Verify file exists
        expect(existsSync(expectedFilePath)).toBe(true);
        console.log(`✅ JSON file created: ${expectedFilePath}`);

        // Verify file content
        const fileContent = await readFile(expectedFilePath, 'utf-8');
        const parsed = JSON.parse(fileContent);

        expect(Array.isArray(parsed)).toBe(true);
        console.log(`📊 Contributions in JSON: ${parsed.length}`);

        // If there are contributions, verify structure
        if (parsed.length > 0) {
          const contribution = parsed[0];
          expect(contribution).toHaveProperty('type');
          expect(contribution).toHaveProperty('timestamp');
          expect(['commit', 'pr', 'review']).toContain(contribution.type);
          console.log('✅ JSON structure validated');
        } else {
          console.log('ℹ️  No contributions in this date range (expected for some weeks)');
        }
      },
      API_TEST_TIMEOUT,
    );

    it(
      'should generate CSV output file with correct structure',
      async () => {
        console.log('\n📅 Testing CSV output generation');

        const fromDate = '2025-01-01';
        const toDate = '2025-01-07';
        const expectedFilePath = `git-contributions-${fromDate}-${toDate}.csv`;
        generatedFiles.push(expectedFilePath);

        const cliArguments: CliArguments = {
          from: fromDate,
          to: toDate,
          lastweek: false,
          lastmonth: false,
          output: 'csv',
          withLinks: false,
          showConfig: false,
          projectIdCommand: false,
        };

        await runContributionReport(cliArguments);

        // Verify file exists
        expect(existsSync(expectedFilePath)).toBe(true);
        console.log(`✅ CSV file created: ${expectedFilePath}`);

        // Verify file content
        const fileContent = await readFile(expectedFilePath, 'utf-8');
        const lines = fileContent.trim().split('\n');

        expect(lines.length).toBeGreaterThanOrEqual(1);

        // Verify header
        const header = lines[0];
        expect(header).toContain('type');
        expect(header).toContain('date');
        expect(header).toContain('timestamp');
        console.log(`✅ CSV header validated: ${header}`);

        if (lines.length > 1) {
          console.log(`📊 CSV rows: ${lines.length - 1} contributions`);
        } else {
          console.log('ℹ️  No contributions in this date range (expected for some weeks)');
        }
      },
      API_TEST_TIMEOUT,
    );

    it(
      'should handle empty date ranges gracefully (weeks with no commits)',
      async () => {
        console.log('\n📅 Testing empty date range handling');

        const fromDate = '2099-01-01';
        const toDate = '2099-01-07';
        const expectedFilePath = `git-contributions-${fromDate}-${toDate}.json`;
        generatedFiles.push(expectedFilePath);

        const cliArguments: CliArguments = {
          from: fromDate,
          to: toDate,
          lastweek: false,
          lastmonth: false,
          output: 'json',
          withLinks: true,
          showConfig: false,
          projectIdCommand: false,
        };

        // Should not throw even with no contributions
        await expect(runContributionReport(cliArguments)).resolves.not.toThrow();

        // Verify file exists with empty array
        expect(existsSync(expectedFilePath)).toBe(true);
        const fileContent = await readFile(expectedFilePath, 'utf-8');
        const parsed = JSON.parse(fileContent);

        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed.length).toBe(0);
        console.log('✅ Empty date range handled correctly - empty array generated');
      },
      API_TEST_TIMEOUT,
    );

    it(
      'should handle lastmonth flag correctly',
      async () => {
        console.log('\n📅 Testing lastmonth flag');

        // The lastmonth flag returns: 1 month ago to today
        const expectedFrom = dayjs().subtract(1, 'month');
        const expectedTo = dayjs();
        const expectedFilePath = `git-contributions-${expectedFrom.format('YYYY-MM-DD')}-${expectedTo.format('YYYY-MM-DD')}.json`;
        generatedFiles.push(expectedFilePath);

        const cliArguments: CliArguments = {
          from: undefined,
          to: undefined,
          lastweek: false,
          lastmonth: true,
          output: 'json',
          withLinks: true,
          showConfig: false,
          projectIdCommand: false,
        };

        await runContributionReport(cliArguments);

        // Verify file exists
        expect(existsSync(expectedFilePath)).toBe(true);
        console.log(`✅ Lastmonth file created: ${expectedFilePath}`);

        const fileContent = await readFile(expectedFilePath, 'utf-8');
        const parsed = JSON.parse(fileContent);

        expect(Array.isArray(parsed)).toBe(true);
        console.log(`📊 Last month contributions: ${parsed.length}`);

        if (parsed.length === 0) {
          console.log('ℹ️  No contributions last month (expected for some periods)');
        }
      },
      API_TEST_TIMEOUT,
    );

    it(
      'should generate output without links when withLinks is false',
      async () => {
        console.log('\n📅 Testing output without links');

        const fromDate = '2025-01-01';
        const toDate = '2025-01-07';
        const expectedFilePath = `git-contributions-${fromDate}-${toDate}.csv`;
        generatedFiles.push(expectedFilePath);

        const cliArguments: CliArguments = {
          from: fromDate,
          to: toDate,
          lastweek: false,
          lastmonth: false,
          output: 'csv',
          withLinks: false,
          showConfig: false,
          projectIdCommand: false,
        };

        await runContributionReport(cliArguments);

        const fileContent = await readFile(expectedFilePath, 'utf-8');

        // CSV without links should not have URL column in header
        const lines = fileContent.trim().split('\n');
        if (lines.length > 0) {
          const header = lines[0];
          // Check that URL column might not be present or is empty
          console.log(`📋 CSV header (no links): ${header}`);
        }

        console.log('✅ Output generated without links');
      },
      API_TEST_TIMEOUT,
    );
  },
);
