#!/usr/bin/env bun

import { parseForEvaluation } from '../src';

const expression = process.argv[2];

if (!expression) {
  console.error('Usage: bun tools/parser.ts "<fhirpath-expression>"');
  process.exit(1);
}

try {
  const ast = parseForEvaluation(expression);
  // AST is returned directly
  console.log(JSON.stringify(ast, null, 2));
} catch (error) {
  console.error('Parse error:', error);
  process.exit(1);
}