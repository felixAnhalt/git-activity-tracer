import dayjs from 'dayjs';
import weekday from 'dayjs/plugin/weekday.js';

dayjs.extend(weekday);

/**
 * Returns the date range for the current week (Monday to current day).
 * If today is Monday, returns Monday to Monday.
 * If today is Tuesday, returns Monday to Tuesday, etc.
 */
export const getCurrentWeekRange = (): { from: dayjs.Dayjs; to: dayjs.Dayjs } => {
  const today = dayjs();
  const dayOfWeek = today.day(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  // Calculate days since Monday (handle Sunday = 0 case)
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = today.subtract(daysSinceMonday, 'day');

  return {
    from: monday.startOf('day'),
    to: today.endOf('day'),
  };
};

export const parseRange = (from?: string, to?: string): { from: dayjs.Dayjs; to: dayjs.Dayjs } => {
  // If both are undefined, use current week
  if (from === undefined && to === undefined) {
    return getCurrentWeekRange();
  }

  // Original logic for when dates are provided
  const today = dayjs().format('YYYY-MM-DD');
  const f = from ?? today;
  const t = to ?? today;
  const parsedFrom = dayjs(f);
  const parsedTo = dayjs(t);
  if (!parsedFrom.isValid() || !parsedTo.isValid()) {
    throw new Error(`Invalid date range: from=${f} to=${t}`);
  }
  if (parsedFrom.isAfter(parsedTo)) {
    return { from: parsedTo, to: parsedFrom };
  }
  return { from: parsedFrom, to: parsedTo };
};
