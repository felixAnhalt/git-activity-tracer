import type { Contribution, FormatterOptions, FormatterResult } from '../types.js';

export interface Formatter {
  format(contributions: Contribution[], options: FormatterOptions): FormatterResult;
}
