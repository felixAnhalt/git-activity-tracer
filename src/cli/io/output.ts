import { promises as fs } from 'fs';
import path from 'path';
import type { Dayjs } from 'dayjs';
import type { OutputFormat } from '../../types.js';
import { generateOutputFilename } from './filename.js';

/**
 * Writes formatted output to console or file based on output format.
 *
 * For console output: writes to stdout
 * For file output: writes to current directory and logs filename
 *
 * @param content - Formatted content to write
 * @param outputFormat - Target output format
 * @param fromDate - Start date for filename generation
 * @param toDate - End date for filename generation
 */
export const writeOutput = async (
  content: string,
  outputFormat: OutputFormat,
  fromDate: Dayjs,
  toDate: Dayjs,
): Promise<void> => {
  try {
    if (outputFormat === 'console') {
      console.log(content);
      return;
    }

    // File-based output
    const filename = generateOutputFilename(fromDate, toDate, outputFormat);
    const filepath = path.resolve(process.cwd(), filename);

    await fs.writeFile(filepath, content, 'utf-8');
    console.log(`Output written to: ${filename}`);
  } catch (error) {
    throw new Error(
      `Failed to write output: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};
