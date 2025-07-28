#!/usr/bin/env bun

import { parse, type ParseResult } from '../legacy-src';

const expression = process.argv[2];
const options = process.argv[3];

if (!expression) {
  console.error('Usage: bun tools/parser.ts "<expression>" [options]');
  console.error('Options: --throw-on-error, --track-ranges, --error-recovery');
  process.exit(1);
}

// Parse options from command line
const throwOnError = options?.includes('--throw-on-error');
const trackRanges = options?.includes('--track-ranges');
const errorRecovery = options?.includes('--error-recovery');

try {
  const result = parse(expression, { throwOnError, trackRanges, errorRecovery });
  console.log(JSON.stringify(result, null, 2));
} catch (error: any) {
  console.error('Parse error:', error.message);
  process.exit(1);
}