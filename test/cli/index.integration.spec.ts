import { describe, it, expect } from 'vitest';
import { main } from '../../src/index.js';

describe('high level cli integration', () => {
  it('should run main without throwing', async () => {
    await expect(main()).resolves.not.toThrow();
  }, 10000); // 10 second timeout
});
