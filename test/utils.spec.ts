import { describe, it, expect } from 'vitest';
import { getCurrentWeekRange } from '../src/utils.js';
import dayjs from 'dayjs';

describe('getCurrentWeekRange', () => {
  it('returns Monday to today for current week', () => {
    const { from, to } = getCurrentWeekRange();
    const today = dayjs();

    // from should be Monday
    expect(from.day()).toBe(1); // 1 = Monday

    // to should be today
    expect(to.format('YYYY-MM-DD')).toBe(today.format('YYYY-MM-DD'));
  });

  it('ensures from is before or equal to to', () => {
    const { from, to } = getCurrentWeekRange();
    expect(from.isBefore(to) || from.isSame(to, 'day')).toBe(true);
  });

  it('handles Monday correctly (from and to are same)', () => {
    const { from, to } = getCurrentWeekRange();
    const dayOfWeek = dayjs().day();

    if (dayOfWeek === 1) {
      expect(from.format('YYYY-MM-DD')).toBe(to.format('YYYY-MM-DD'));
    }
  });
});
