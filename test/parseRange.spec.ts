import { describe, it, expect } from 'vitest';
import { parseRange } from '../src/utils.js';
import dayjs from 'dayjs';

describe('parseRange', () => {
  it('returns today when no args provided', () => {
    const { from, to } = parseRange();
    const today = dayjs().format('YYYY-MM-DD');
    expect(from.format('YYYY-MM-DD')).toBe(today);
    expect(to.format('YYYY-MM-DD')).toBe(today);
  });

  it('parses provided dates', () => {
    const { from, to } = parseRange('2020-01-01', '2020-01-02');
    expect(from.format('YYYY-MM-DD')).toBe('2020-01-01');
    expect(to.format('YYYY-MM-DD')).toBe('2020-01-02');
  });

  it('swaps reversed dates so from <= to', () => {
    const { from, to } = parseRange('2020-01-03', '2020-01-01');
    expect(from.format('YYYY-MM-DD')).toBe('2020-01-01');
    expect(to.format('YYYY-MM-DD')).toBe('2020-01-03');
  });

  it('throws on invalid date strings', () => {
    expect(() => parseRange('not-a-date', '2020-01-01')).toThrow();
    expect(() => parseRange('2020-01-01', 'not-a-date')).toThrow();
  });
});
