import { describe, it, expect } from 'vitest';
import { CsvFormatter } from '../../src/formatters/csv.js';
import type { Contribution } from '../../src/types.js';

describe('CsvFormatter', () => {
  const formatter = new CsvFormatter();

  it('formats contributions as CSV with headers', () => {
    const contributions: Contribution[] = [
      {
        type: 'commit',
        timestamp: '2024-01-01T10:30:00Z',
        text: 'Fix bug',
        url: 'https://github.com/user/repository/commit/abc',
      },
    ];

    const result = formatter.format(contributions, { withLinks: true });
    const lines = result.content.split('\n');

    expect(lines[0]).toBe('type,timestamp,date,repository,target,projectId,text,url');
    expect(lines[1]).toContain('commit');
    expect(lines[1]).toContain('2024-01-01T10:30:00Z');
  });

  it('excludes URL column when withLinks is false', () => {
    const contributions: Contribution[] = [
      {
        type: 'commit',
        timestamp: '2024-01-01T10:30:00Z',
        text: 'Fix bug',
        url: 'https://github.com/user/repository/commit/abc',
      },
    ];

    const result = formatter.format(contributions, { withLinks: false });
    const lines = result.content.split('\n');

    expect(lines[0]).toBe('type,timestamp,date,repository,target,projectId,text');
    expect(lines[0]).not.toContain('url');
  });

  it('escapes CSV special characters', () => {
    const contributions: Contribution[] = [
      {
        type: 'commit',
        timestamp: '2024-01-01T10:30:00Z',
        text: 'Fix bug, add feature',
      },
    ];

    const result = formatter.format(contributions, { withLinks: false });
    // Should wrap in quotes due to comma
    expect(result.content).toContain('"Fix bug, add feature"');
  });

  it('escapes double quotes in text', () => {
    const contributions: Contribution[] = [
      {
        type: 'commit',
        timestamp: '2024-01-01T10:30:00Z',
        text: 'Fix "critical" bug',
      },
    ];

    const result = formatter.format(contributions, { withLinks: false });
    // Should escape quotes by doubling them
    expect(result.content).toContain('"Fix ""critical"" bug"');
  });

  it('sorts contributions by timestamp', () => {
    const contributions: Contribution[] = [
      {
        type: 'commit',
        timestamp: '2024-01-01T12:00:00Z',
        text: 'Second commit',
      },
      {
        type: 'commit',
        timestamp: '2024-01-01T10:00:00Z',
        text: 'First commit',
      },
    ];

    const result = formatter.format(contributions, { withLinks: false });
    const lines = result.content.split('\n');

    expect(lines[1]).toContain('First commit');
    expect(lines[2]).toContain('Second commit');
  });

  it('handles empty text fields', () => {
    const contributions: Contribution[] = [
      {
        type: 'commit',
        timestamp: '2024-01-01T10:30:00Z',
      },
    ];

    const result = formatter.format(contributions, { withLinks: false });
    const lines = result.content.split('\n');

    expect(lines[1]).toContain('commit,2024-01-01T10:30:00Z,2024-01-01,,,,');
  });

  it('includes repository column and data', () => {
    const contributions: Contribution[] = [
      {
        type: 'commit',
        timestamp: '2024-01-01T10:30:00Z',
        text: 'Fix bug',
        repository: 'user/repository',
      },
    ];

    const result = formatter.format(contributions, { withLinks: false });
    const lines = result.content.split('\n');

    expect(lines[0]).toContain('repository');
    expect(lines[1]).toContain('user/repository');
  });

  it('handles missing repository gracefully', () => {
    const contributions: Contribution[] = [
      {
        type: 'commit',
        timestamp: '2024-01-01T10:30:00Z',
        text: 'Fix bug',
      },
    ];

    const result = formatter.format(contributions, { withLinks: false });
    const lines = result.content.split('\n');

    expect(lines[0]).toContain('repository');
    expect(lines[1]).toContain('commit,2024-01-01T10:30:00Z,2024-01-01,,,,Fix bug');
  });

  it('includes target branch column and data', () => {
    const contributions: Contribution[] = [
      {
        type: 'commit',
        timestamp: '2024-01-01T10:30:00Z',
        text: 'Fix bug',
        repository: 'user/repository',
        target: 'main',
      },
    ];

    const result = formatter.format(contributions, { withLinks: false });
    const lines = result.content.split('\n');

    expect(lines[0]).toContain('target');
    expect(lines[1]).toContain('main');
  });

  it('includes date column extracted from timestamp', () => {
    const contributions: Contribution[] = [
      {
        type: 'commit',
        timestamp: '2024-01-15T14:30:00Z',
        text: 'Fix bug',
      },
    ];

    const result = formatter.format(contributions, { withLinks: false });
    const lines = result.content.split('\n');

    expect(lines[0]).toContain('date');
    expect(lines[1]).toContain('2024-01-15');
  });

  it('date field is always present in CSV', () => {
    const contributions: Contribution[] = [
      {
        type: 'commit',
        timestamp: '2024-12-31T23:59:59Z',
        text: 'New year commit',
      },
    ];

    const result = formatter.format(contributions, { withLinks: false });
    const lines = result.content.split('\n');

    expect(lines[0].split(',')).toContain('date');
    expect(lines[1]).toContain('2024-12-31');
  });

  it('includes projectId column when available', () => {
    const contributions: Contribution[] = [
      {
        type: 'commit',
        timestamp: '2024-01-01T10:30:00Z',
        text: 'Fix bug',
        repository: 'user/repository',
        projectId: 'PROJECT-123',
      },
    ];

    const result = formatter.format(contributions, { withLinks: false });
    const lines = result.content.split('\n');

    expect(lines[0]).toContain('projectId');
    expect(lines[1]).toContain('PROJECT-123');
  });

  it('handles missing projectId gracefully', () => {
    const contributions: Contribution[] = [
      {
        type: 'commit',
        timestamp: '2024-01-01T10:30:00Z',
        text: 'Fix bug',
        repository: 'user/repository',
      },
    ];

    const result = formatter.format(contributions, { withLinks: false });
    const lines = result.content.split('\n');

    expect(lines[0]).toContain('projectId');
    expect(lines[1]).toContain('user/repository,,,Fix bug');
  });
});
