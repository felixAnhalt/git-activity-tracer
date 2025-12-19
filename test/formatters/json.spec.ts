import { describe, it, expect } from 'vitest';
import { JsonFormatter } from '../../src/formatters/json.js';
import type { Contribution } from '../../src/types.js';

describe('JsonFormatter', () => {
  const formatter = new JsonFormatter();

  it('formats contributions as valid JSON array', () => {
    const contributions: Contribution[] = [
      {
        type: 'commit',
        timestamp: '2024-01-01T10:30:00Z',
        text: 'Fix bug',
        url: 'https://github.com/user/repository/commit/abc',
      },
    ];

    const result = formatter.format(contributions, { withLinks: true });
    const parsed = JSON.parse(result.content);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].type).toBe('commit');
    expect(parsed[0].url).toBe('https://github.com/user/repository/commit/abc');
  });

  it('excludes URLs when withLinks is false', () => {
    const contributions: Contribution[] = [
      {
        type: 'commit',
        timestamp: '2024-01-01T10:30:00Z',
        text: 'Fix bug',
        url: 'https://github.com/user/repository/commit/abc',
      },
    ];

    const result = formatter.format(contributions, { withLinks: false });
    const parsed = JSON.parse(result.content);

    expect(parsed[0].url).toBeUndefined();
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
    const parsed = JSON.parse(result.content);

    expect(parsed[0].text).toBe('First commit');
    expect(parsed[1].text).toBe('Second commit');
  });

  it('handles empty contributions array', () => {
    const result = formatter.format([], { withLinks: false });
    const parsed = JSON.parse(result.content);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(0);
  });

  it('includes repository when available', () => {
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
    const parsed = JSON.parse(result.content);

    expect(parsed[0].repository).toBe('user/repository');
  });

  it('omits repository when not available', () => {
    const contributions: Contribution[] = [
      {
        type: 'commit',
        timestamp: '2024-01-01T10:30:00Z',
        text: 'Fix bug',
      },
    ];

    const result = formatter.format(contributions, { withLinks: false });
    const parsed = JSON.parse(result.content);

    expect(parsed[0].repository).toBeUndefined();
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
    const parsed = JSON.parse(result.content);

    expect(parsed[0].target).toBe('main');
  });

  it('omits target when not available', () => {
    const contributions: Contribution[] = [
      {
        type: 'commit',
        timestamp: '2024-01-01T10:30:00Z',
        text: 'Fix bug',
      },
    ];

    const result = formatter.format(contributions, { withLinks: false });
    const parsed = JSON.parse(result.content);

    expect(parsed[0].target).toBeUndefined();
  });

  it('includes date field extracted from timestamp', () => {
    const contributions: Contribution[] = [
      {
        type: 'commit',
        timestamp: '2024-01-15T14:30:00Z',
        text: 'Fix bug',
      },
    ];

    const result = formatter.format(contributions, { withLinks: false });
    const parsed = JSON.parse(result.content);

    expect(parsed[0].date).toBe('2024-01-15');
  });

  it('always includes date field', () => {
    const contributions: Contribution[] = [
      {
        type: 'commit',
        timestamp: '2024-12-31T23:59:59Z',
        text: 'New year commit',
      },
    ];

    const result = formatter.format(contributions, { withLinks: false });
    const parsed = JSON.parse(result.content);

    expect(parsed[0]).toHaveProperty('date');
    expect(parsed[0].date).toBe('2024-12-31');
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
    const parsed = JSON.parse(result.content);

    expect(parsed[0].projectId).toBe('PROJECT-123');
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
    const parsed = JSON.parse(result.content);

    expect(parsed[0].projectId).toBeUndefined();
  });
});
