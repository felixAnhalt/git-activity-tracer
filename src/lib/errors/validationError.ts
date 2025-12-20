/**
 * Error thrown when user input validation fails.
 * Includes helpful suggestions for how to fix the error.
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public suggestions: string[] = [],
  ) {
    super(message);
    this.name = 'ValidationError';
    Error.captureStackTrace(this, ValidationError);
  }
}
