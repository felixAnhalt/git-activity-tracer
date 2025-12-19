import type { OutputFormat } from '../types.js';
import type { Formatter } from './types.js';
import { ConsoleFormatter } from './console.js';
import { JsonFormatter } from './json.js';
import { CsvFormatter } from './csv.js';

export { ConsoleFormatter } from './console.js';
export { JsonFormatter } from './json.js';
export { CsvFormatter } from './csv.js';
export type { Formatter } from './types.js';

export const createFormatter = (format: OutputFormat): Formatter => {
  switch (format) {
    case 'console':
      return new ConsoleFormatter();
    case 'json':
      return new JsonFormatter();
    case 'csv':
      return new CsvFormatter();
    default:
      throw new Error(`Unknown output format: ${format}`);
  }
};
