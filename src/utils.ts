import dayjs from 'dayjs';

export function parseRange(from?: string, to?: string): { from: dayjs.Dayjs; to: dayjs.Dayjs } {
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
}
