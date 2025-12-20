import { describe, it, expect } from 'vitest';
import { createFormatter } from '../../src/formatters/index.js';
import type { Contribution } from '../../src/types.js';
import type { OutputFormat } from '../../src/types.js';

/**
 * Integration tests for formatters
 *
 * Tests the complete formatting workflow including:
 * - Factory function (createFormatter)
 * - All three output formats (console, JSON, CSV)
 * - Empty data handling
 * - With/without links options
 */

describe('Formatter Integration', () => {
  const sampleContributions: Contribution[] = [
    {
      type: 'commit',
      timestamp: '2025-01-15T10:30:00Z',
      text: 'Add new feature',
      url: 'https://github.com/user/repository/commit/abc123',
      repository: 'user/repository',
    },
    {
      type: 'pr',
      timestamp: '2025-01-14T15:45:00Z',
      text: 'Fix bug in authentication',
      url: 'https://github.com/user/repository/pull/42',
      repository: 'user/repository',
      target: 'main',
    },
    {
      type: 'review',
      timestamp: '2025-01-13T09:15:00Z',
      text: 'Approve changes',
      url: 'https://github.com/user/repository/pull/41',
      repository: 'user/repository',
    },
  ];

  const sampleContributionsWithProjectId: Contribution[] = [
    {
      type: 'commit',
      timestamp: '2025-01-15T10:30:00Z',
      text: 'Add new feature',
      url: 'https://github.com/user/repository/commit/abc123',
      repository: 'user/repository',
      projectId: 'PROJECT-123',
    },
  ];

  describe('Factory Function', () => {
    it('should create console formatter', () => {
      const formatter = createFormatter('console');
      expect(formatter).toBeDefined();
      expect(formatter.format).toBeDefined();
    });

    it('should create JSON formatter', () => {
      const formatter = createFormatter('json');
      expect(formatter).toBeDefined();
      expect(formatter.format).toBeDefined();
    });

    it('should create CSV formatter', () => {
      const formatter = createFormatter('csv');
      expect(formatter).toBeDefined();
      expect(formatter.format).toBeDefined();
    });

    it('should throw error for unknown format', () => {
      expect(() => createFormatter('unknown' as OutputFormat)).toThrow('Unknown output format');
    });
  });

  describe('Console Formatter Integration', () => {
    it('should format contributions for console output', () => {
      const formatter = createFormatter('console');
      const result = formatter.format(sampleContributions, { withLinks: true });

      expect(result.content).toBeDefined();
      expect(typeof result.content).toBe('string');
      expect(result.content.length).toBeGreaterThan(0);

      // Should contain contribution details
      expect(result.content).toContain('commit');
      expect(result.content).toContain('Add new feature');
      console.log('✓ Console format generated successfully');
    });

    it('should format with project IDs when present', () => {
      const formatter = createFormatter('console');
      const result = formatter.format(sampleContributionsWithProjectId, { withLinks: true });

      expect(result.content).toContain('PROJECT-123');
      console.log('✓ Console format with project ID generated successfully');
    });

    it('should handle empty contributions array', () => {
      const formatter = createFormatter('console');
      const result = formatter.format([], { withLinks: true });

      expect(result.content).toBeDefined();
      expect(typeof result.content).toBe('string');
      console.log('✓ Console format handles empty array (weeks with no commits)');
    });

    it('should format without links when requested', () => {
      const formatter = createFormatter('console');
      const result = formatter.format(sampleContributions, { withLinks: false });

      expect(result.content).toBeDefined();
      expect(typeof result.content).toBe('string');
      console.log('✓ Console format without links generated successfully');
    });
  });

  describe('JSON Formatter Integration', () => {
    it('should format contributions as valid JSON', () => {
      const formatter = createFormatter('json');
      const result = formatter.format(sampleContributions, { withLinks: true });

      expect(result.content).toBeDefined();
      expect(typeof result.content).toBe('string');

      // Should be valid JSON
      const parsed = JSON.parse(result.content);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(3);

      // Verify structure - JSON formatter sorts by timestamp, so first is 'review' (Jan 13)
      expect(parsed[0]).toHaveProperty('type');
      expect(parsed[0]).toHaveProperty('timestamp');
      expect(parsed[0].type).toBe('review');
      console.log('✓ JSON format generated and validated successfully');
    });

    it('should include all contribution fields in JSON', () => {
      const formatter = createFormatter('json');
      const result = formatter.format(sampleContributions, { withLinks: true });

      const parsed = JSON.parse(result.content);
      // After sorting by timestamp: review (Jan 13), pr (Jan 14), commit (Jan 15)
      const commitContribution = parsed[2]; // Last item after sort

      expect(commitContribution.type).toBe('commit');
      expect(commitContribution.timestamp).toBe('2025-01-15T10:30:00Z');
      expect(commitContribution.text).toBe('Add new feature');
      expect(commitContribution.url).toBe('https://github.com/user/repository/commit/abc123');
      expect(commitContribution.repository).toBe('user/repository');
      console.log('✓ JSON includes all fields correctly');
    });

    it('should handle empty contributions array as empty JSON array', () => {
      const formatter = createFormatter('json');
      const result = formatter.format([], { withLinks: true });

      const parsed = JSON.parse(result.content);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(0);
      console.log('✓ JSON format handles empty array (weeks with no commits)');
    });

    it('should include project ID in JSON when present', () => {
      const formatter = createFormatter('json');
      const result = formatter.format(sampleContributionsWithProjectId, { withLinks: true });

      const parsed = JSON.parse(result.content);
      expect(parsed[0].projectId).toBe('PROJECT-123');
      console.log('✓ JSON includes project ID when present');
    });
  });

  describe('CSV Formatter Integration', () => {
    it('should format contributions as valid CSV', () => {
      const formatter = createFormatter('csv');
      const result = formatter.format(sampleContributions, { withLinks: true });

      expect(result.content).toBeDefined();
      expect(typeof result.content).toBe('string');

      const lines = result.content.trim().split('\n');
      expect(lines.length).toBeGreaterThan(1); // Header + data rows

      // Verify header - CSV formatter uses lowercase headers
      const header = lines[0];
      expect(header).toContain('type');
      expect(header).toContain('date');
      expect(header).toContain('timestamp');
      console.log('✓ CSV format generated with proper header');
    });

    it('should format CSV rows correctly', () => {
      const formatter = createFormatter('csv');
      const result = formatter.format(sampleContributions, { withLinks: true });

      const lines = result.content.trim().split('\n');
      expect(lines.length).toBe(4); // 1 header + 3 data rows

      // Verify data row - CSV sorts by timestamp, so first is 'review' (Jan 13)
      const firstDataRow = lines[1];
      expect(firstDataRow).toContain('review');
      console.log('✓ CSV data rows formatted correctly');
    });

    it('should handle empty contributions array as CSV with header only', () => {
      const formatter = createFormatter('csv');
      const result = formatter.format([], { withLinks: true });

      const lines = result.content.trim().split('\n');
      expect(lines.length).toBe(1); // Header only

      const header = lines[0];
      expect(header).toContain('type');
      console.log('✓ CSV format handles empty array (weeks with no commits)');
    });

    it('should include project ID column in CSV when present', () => {
      const formatter = createFormatter('csv');
      const result = formatter.format(sampleContributionsWithProjectId, { withLinks: true });

      const lines = result.content.trim().split('\n');
      const header = lines[0];

      // Should have project ID in header - CSV uses 'projectId' not 'Project'
      expect(header).toContain('projectId');

      // Should have project ID in data row
      const dataRow = lines[1];
      expect(dataRow).toContain('PROJECT-123');
      console.log('✓ CSV includes project ID column when present');
    });

    it('should format CSV without links when requested', () => {
      const formatter = createFormatter('csv');
      const result = formatter.format(sampleContributions, { withLinks: false });

      expect(result.content).toBeDefined();
      expect(typeof result.content).toBe('string');

      const lines = result.content.trim().split('\n');
      expect(lines.length).toBeGreaterThan(1);
      console.log('✓ CSV format without links generated successfully');
    });
  });

  describe('Cross-Format Consistency', () => {
    it('should produce consistent data across all formats', () => {
      const consoleFormatter = createFormatter('console');
      const jsonFormatter = createFormatter('json');
      const csvFormatter = createFormatter('csv');

      const consoleResult = consoleFormatter.format(sampleContributions, { withLinks: true });
      const jsonResult = jsonFormatter.format(sampleContributions, { withLinks: true });
      const csvResult = csvFormatter.format(sampleContributions, { withLinks: true });

      // All should produce non-empty output
      expect(consoleResult.content.length).toBeGreaterThan(0);
      expect(jsonResult.content.length).toBeGreaterThan(0);
      expect(csvResult.content.length).toBeGreaterThan(0);

      // JSON should have 3 items
      const parsedJson = JSON.parse(jsonResult.content);
      expect(parsedJson.length).toBe(3);

      // CSV should have 4 lines (header + 3 data)
      const csvLines = csvResult.content.trim().split('\n');
      expect(csvLines.length).toBe(4);

      console.log('✓ All formats produce consistent data');
    });

    it('should handle empty data consistently across all formats', () => {
      const consoleFormatter = createFormatter('console');
      const jsonFormatter = createFormatter('json');
      const csvFormatter = createFormatter('csv');

      const consoleResult = consoleFormatter.format([], { withLinks: true });
      const jsonResult = jsonFormatter.format([], { withLinks: true });
      const csvResult = csvFormatter.format([], { withLinks: true });

      // All should handle empty gracefully
      expect(consoleResult.content).toBeDefined();
      expect(jsonResult.content).toBeDefined();
      expect(csvResult.content).toBeDefined();

      // JSON should be empty array
      const parsedJson = JSON.parse(jsonResult.content);
      expect(parsedJson.length).toBe(0);

      // CSV should have header only
      const csvLines = csvResult.content.trim().split('\n');
      expect(csvLines.length).toBe(1);

      console.log('✓ All formats handle empty data consistently (weeks with no commits)');
    });
  });
});
