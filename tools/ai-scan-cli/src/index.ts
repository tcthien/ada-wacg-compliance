#!/usr/bin/env node
/**
 * Main entry point for AI Scan CLI
 * This file is referenced in package.json bin field
 */

import { main } from './cli.js';

// Execute the CLI
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
