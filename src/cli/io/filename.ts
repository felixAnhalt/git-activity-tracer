import type { Dayjs } from 'dayjs';
import type { FileOutputFormat } from '../types.js';

/**
 * Generates a filename for file-based outputs (JSON, CSV).
 *
 * @param fromDate - Start date
 * @param toDate - End date
 * @param format - Output format (json or csv)
 * @returns Filename in format: git-contributions-YYYY-MM-DD-YYYY-MM-DD.ext
 */
export const generateOutputFilename = (
  fromDate: Dayjs,
  toDate: Dayjs,
  format: FileOutputFormat,
): string => {
  const fromFormatted = fromDate.format('YYYY-MM-DD');
  const toFormatted = toDate.format('YYYY-MM-DD');
  return `git-contributions-${fromFormatted}-${toFormatted}.${format}`;
};
