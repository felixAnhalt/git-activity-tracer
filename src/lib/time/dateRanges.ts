import dayjs from 'dayjs';
import weekday from 'dayjs/plugin/weekday.js';
import { ValidationError } from '../errors/validationError.js';

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

/**
 * Returns the date range for last week (Monday to Sunday).
 */
export const getLastWeekRange = (): { from: dayjs.Dayjs; to: dayjs.Dayjs } => {
  const today = dayjs();
  const dayOfWeek = today.day(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  // Calculate days since Monday of current week
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  // Get Monday of current week, then subtract 7 days to get Monday of last week
  const lastWeekMonday = today.subtract(daysSinceMonday, 'day').subtract(7, 'day');

  // Sunday is 6 days after Monday
  const lastWeekSunday = lastWeekMonday.add(6, 'day');

  return {
    from: lastWeekMonday.startOf('day'),
    to: lastWeekSunday.endOf('day'),
  };
};

/**
 * Returns the date range for last month (calculated from today, 4 weeks back).
 */
export const getLastMonthRange = (): { from: dayjs.Dayjs; to: dayjs.Dayjs } => {
  const today = dayjs();

  const oneMonthAgo = today.subtract(1, 'month');

  return {
    from: oneMonthAgo.startOf('day'),
    to: today.endOf('day'),
  };
};

export const parseRange = (
  from?: string,
  to?: string,
  lastweek?: boolean,
  lastmonth?: boolean,
): { from: dayjs.Dayjs; to: dayjs.Dayjs } => {
  // Handle --lastweek flag
  if (lastweek) {
    return getLastWeekRange();
  }

  // Handle --lastmonth flag
  if (lastmonth) {
    return getLastMonthRange();
  }

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
  if (!parsedFrom.isValid()) {
    throw new ValidationError(`Invalid start date: ${f}`, [
      'Use YYYY-MM-DD format (e.g., 2025-01-15)',
      'Or use a preset: last-week, last-month, this-week',
    ]);
  }
  if (!parsedTo.isValid()) {
    throw new ValidationError(`Invalid end date: ${t}`, [
      'Use YYYY-MM-DD format (e.g., 2025-01-31)',
      'Or use a preset: last-week, last-month, this-week',
    ]);
  }
  if (parsedFrom.isAfter(parsedTo)) {
    return { from: parsedTo.startOf('day'), to: parsedFrom.endOf('day') };
  }
  return { from: parsedFrom.startOf('day'), to: parsedTo.endOf('day') };
};
