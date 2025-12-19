import { describe, it, expect } from 'vitest';
import { ConsoleFormatter } from '../../src/formatters/console.js';
import type { Contribution } from '../../src/types.js';

describe('ConsoleFormatter', () => {
  const formatter = new ConsoleFormatter();

  it('formats empty contributions', () => {
    const result = formatter.format([], { withLinks: false });
    expect(result.content).toContain('No contributions found');
  });

  it('formats contributions grouped by date', () => {
    const contributions: Contribution[] = [
      {
        type: 'commit',
        timestamp: '2024-01-01T10:30:00Z',
        text: 'Fix bug',
        url: 'https://github.com/user/repository/commit/abc',
      },
    ];

    const result = formatter.format(contributions, { withLinks: false });
    expect(result.content).toContain('2024-01-01');
    expect(result.content).toContain('commit');
    expect(result.content).toContain('10:30:00');
    expect(result.content).toContain('Fix bug');
    expect(result.content).not.toContain('https://');
  });

  it('includes links when withLinks is true', () => {
    const contributions: Contribution[] = [
      {
        type: 'commit',
        timestamp: '2024-01-01T10:30:00Z',
        text: 'Fix bug',
        url: 'https://github.com/user/repository/commit/abc',
      },
    ];

    const result = formatter.format(contributions, { withLinks: true });
    expect(result.content).toContain('https://github.com/user/repository/commit/abc');
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
    const firstIndex = result.content.indexOf('First commit');
    const secondIndex = result.content.indexOf('Second commit');
    expect(firstIndex).toBeLessThan(secondIndex);
  });

  it('includes repository information when available', () => {
    const contributions: Contribution[] = [
      {
        type: 'commit',
        timestamp: '2024-01-01T10:30:00Z',
        text: 'Fix bug',
        url: 'https://github.com/user/repository/commit/abc',
        repository: 'user/repository',
      },
    ];

    const result = formatter.format(contributions, { withLinks: false });
    expect(result.content).toContain('[user/repository]');
    expect(result.content).toContain('2024-01-01');
    expect(result.content).toContain('10:30:00');
  });

  it('groups by date not hour', () => {
    const contributions: Contribution[] = [
      {
        type: 'commit',
        timestamp: '2024-01-01T10:30:00Z',
        text: 'First commit',
      },
      {
        type: 'commit',
        timestamp: '2024-01-01T14:45:00Z',
        text: 'Second commit',
      },
    ];

    const result = formatter.format(contributions, { withLinks: false });
    const dateHeaders = result.content.match(/## 2024-01-01/g);
    expect(dateHeaders?.length).toBe(1);
  });

  it('includes target branch when available', () => {
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
    expect(result.content).toContain('(main)');
  });

  it('includes projectId when available', () => {
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
    expect(result.content).toContain('{PROJECT-123}');
  });

  it('omits projectId when not available', () => {
    const contributions: Contribution[] = [
      {
        type: 'commit',
        timestamp: '2024-01-01T10:30:00Z',
        text: 'Fix bug',
        repository: 'user/repository',
      },
    ];

    const result = formatter.format(contributions, { withLinks: false });
    expect(result.content).not.toContain('{');
    expect(result.content).toContain('[user/repository]');
  });
});
