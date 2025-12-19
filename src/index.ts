#!/usr/bin/env node

import 'dotenv/config';
import { main } from './cli/index.js';

// Top-level run with proper error handling to avoid unhandled rejections
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// Re-export CLI entry for programmatic use
export * from './cli/index.js';
