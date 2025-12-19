import { describe, it, expect } from 'vitest';
import { parseRange, getLastWeekRange, getLastMonthRange } from '../src/utils.js';
import dayjs from 'dayjs';

describe('parseRange', () => {
  it('returns current week range when no args provided', () => {
    const { from, to } = parseRange();
    const today = dayjs();

    // from should be Monday of current week
    expect(from.day()).toBe(1); // 1 = Monday

    // to should be today
    expect(to.format('YYYY-MM-DD')).toBe(today.format('YYYY-MM-DD'));

    // from should be before or equal to to
    expect(from.isBefore(to) || from.isSame(to, 'day')).toBe(true);
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

  it('returns last week range when lastweek flag is true', () => {
    const { from, to } = parseRange(undefined, undefined, true);

    // from should be Monday
    expect(from.day()).toBe(1);

    // to should be Sunday
    expect(to.day()).toBe(0);

    // Range should be 7 days
    expect(to.diff(from, 'day')).toBe(6);

    // Both should be in the past
    const today = dayjs();
    expect(from.isBefore(today, 'day')).toBe(true);
    expect(to.isBefore(today, 'day') || to.isSame(today, 'day')).toBe(true);
  });

  it('returns last month range when lastmonth flag is true', () => {
    const { from, to } = parseRange(undefined, undefined, false, true);

    const today = dayjs();
    const oneMonthAgo = today.subtract(1, 'month');

    // from should be first day of last month
    expect(from.date()).toBe(oneMonthAgo.date());

    // to should be last day of last month
    expect(to.date()).toBe(today.date());

    // Both should be in the past
    expect(from.isBefore(today, 'day')).toBe(true);
    expect(to.isBefore(today, 'day') || to.isSame(today, 'day')).toBe(true);
  });

  it('prioritizes lastweek over explicit dates', () => {
    const { from, to } = parseRange('2020-01-01', '2020-01-02', true);

    // Should use lastweek range, not the provided dates
    expect(from.day()).toBe(1); // Monday
    expect(to.day()).toBe(0); // Sunday
    expect(from.format('YYYY-MM-DD')).not.toBe('2020-01-01');
  });

  it('prioritizes lastmonth over explicit dates', () => {
    const { from, to } = parseRange('2020-01-01', '2020-01-02', false, true);

    const today = dayjs();
    const oneMonthAgo = today.subtract(1, 'month');

    // Should use lastmonth range, not the provided dates

    // from should be first day of last month
    expect(from.date()).toBe(oneMonthAgo.date());

    // to should be last day of last month
    expect(to.date()).toBe(today.date());
  });
});

describe('getLastWeekRange', () => {
  it('returns Monday to Sunday of last week', () => {
    const { from, to } = getLastWeekRange();

    // from should be Monday
    expect(from.day()).toBe(1);

    // to should be Sunday
    expect(to.day()).toBe(0);

    // Range should be exactly 7 days
    expect(to.diff(from, 'day')).toBe(6);
  });
});

describe('getLastMonthRange', () => {
  it('returns first to last day of last month', () => {
    const { from, to } = getLastMonthRange();

    const today = dayjs();
    const oneMonthAgo = today.subtract(1, 'month');

    // from should be first day of month
    expect(from.date()).toBe(oneMonthAgo.date());

    // to should be last day of month
    expect(to.date()).toBe(today.date());

    // Both should be in same month
    expect(from.month()).toBe(oneMonthAgo.month());

    // Both should be in same year
    expect(from.year()).toBe(to.year());
  });

  it('returns previous month, not current month', () => {
    const { from, to } = getLastMonthRange();
    const today = dayjs();

    // Last month should be before current month
    if (today.month() === 0) {
      // If current month is January, last month should be December of previous year
      expect(from.month()).toBe(11);
      expect(from.year()).toBe(today.year() - 1);
    } else {
      expect(from.month()).toBe(today.month() - 1);
      expect(from.year()).toBe(today.year());
    }
  });
});
