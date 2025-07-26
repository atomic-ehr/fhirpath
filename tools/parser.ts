#!/usr/bin/env bun

import { parse, ParserMode, type ParseResult } from '../src';

const expression = process.argv[2];
const mode = (process.argv[3] as ParserMode) || ParserMode.Standard;

if (!expression) {
  console.error('Usage: bun tools/parser.ts "<expression>" [mode]');
  console.error('Modes: fast, standard, diagnostic');
  process.exit(1);
}

try {
  const result = parse(expression, { mode });
  console.log(JSON.stringify(result, null, 2));
} catch (error: any) {
  console.error('Parse error:', error.message);
  process.exit(1);
}