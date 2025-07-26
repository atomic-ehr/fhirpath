#!/usr/bin/env bun

import { parse, ParserMode, type ParseResult } from '../src';

const expression = process.argv[2];
const mode = (process.argv[3] as ParserMode) || ParserMode.Standard;

if (!expression) {
  console.error('Usage: bun tools/parser.ts "<expression>" [mode]');
  console.error('Modes: fast, standard, diagnostic, validate');
  process.exit(1);
}

try {
  const result = parse(expression, { mode });
  
  // For validate mode, just show validity
  if (mode === ParserMode.Validate) {
    console.log(JSON.stringify({
      valid: !('hasErrors' in result && result.hasErrors),
      diagnostics: 'diagnostics' in result ? result.diagnostics : []
    }, null, 2));
  } else {
    // For other modes, show the full result
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error: any) {
  console.error('Parse error:', error.message);
  process.exit(1);
}