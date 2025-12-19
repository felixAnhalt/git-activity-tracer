import type { Contribution, FormatterOptions, FormatterResult } from '../types.js';
import type { Formatter } from './types.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);

export class CsvFormatter implements Formatter {
  format(contributions: Contribution[], options: FormatterOptions): FormatterResult {
    const sorted = [...contributions].sort(
      (a, b) => dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf(),
    );

    const lines: string[] = [];

    // Header row
    const headers = ['type', 'timestamp', 'date', 'repository', 'target', 'text'];
    if (options.withLinks) {
      headers.push('url');
    }
    lines.push(headers.join(','));

    // Data rows
    for (const contribution of sorted) {
      const row = [
        this.escapeCsvField(contribution.type),
        this.escapeCsvField(contribution.timestamp),
        this.escapeCsvField(dayjs.utc(contribution.timestamp).format('YYYY-MM-DD')),
        this.escapeCsvField(contribution.repository ?? ''),
        this.escapeCsvField(contribution.target ?? ''),
        this.escapeCsvField(contribution.text ?? ''),
      ];

      if (options.withLinks) {
        row.push(this.escapeCsvField(contribution.url ?? ''));
      }

      lines.push(row.join(','));
    }

    return {
      content: lines.join('\n'),
    };
  }

  private escapeCsvField(field: string): string {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }
}
