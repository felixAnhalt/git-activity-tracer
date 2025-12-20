import chalk from 'chalk';
import { ValidationError } from '../lib/errors/validationError.js';

/**
 * Handles errors in the CLI with user-friendly formatting.
 * Provides colored output and helpful suggestions for validation errors.
 */
export const handleError = (error: unknown): never => {
  if (error instanceof ValidationError) {
    console.error(chalk.red('✗'), chalk.bold(error.message));
    if (error.suggestions.length > 0) {
      console.error(chalk.dim('\nSuggestions:'));
      error.suggestions.forEach((suggestion) => console.error(chalk.dim('  • ') + suggestion));
    }
  } else if (error instanceof Error) {
    console.error(chalk.red('Error:'), error.message);
    if (error.stack && process.env.DEBUG) {
      console.error(chalk.dim('\nStack trace:'));
      console.error(chalk.dim(error.stack));
    }
  } else {
    console.error(chalk.red('Fatal error:'), String(error));
  }

  process.exit(1);
};
