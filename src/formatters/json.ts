import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import type { Contribution, FormatterOptions, FormatterResult } from '../types.js';
import type { Formatter } from './types.js';

dayjs.extend(utc);

export class JsonFormatter implements Formatter {
  format(contributions: Contribution[], options: FormatterOptions): FormatterResult {
    const sorted = [...contributions].sort(
      (a, b) => dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf(),
    );

    // Build output structure
    const output = sorted.map((contribution) => {
      const item: Record<string, unknown> = {
        type: contribution.type,
        timestamp: contribution.timestamp,
        date: dayjs.utc(contribution.timestamp).format('YYYY-MM-DD'),
      };

      if (contribution.repository) {
        item.repository = contribution.repository;
      }

      if (contribution.target) {
        item.target = contribution.target;
      }

      if (contribution.projectId) {
        item.projectId = contribution.projectId;
      }

      if (contribution.text) {
        item.text = contribution.text;
      }

      if (options.withLinks && contribution.url) {
        item.url = contribution.url;
      }

      return item;
    });

    return {
      content: JSON.stringify(output, null, 2),
    };
  }
}
