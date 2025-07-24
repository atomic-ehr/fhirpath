#!/usr/bin/env bun

import { parse } from '../src';

const expression = process.argv[2];

if (!expression) {
  console.error('Usage: bun tools/parser.ts "<fhirpath-expression>"');
  process.exit(1);
}

try {
  const expr = parse(expression);
  // Access the AST from the expression object
  console.log(JSON.stringify(expr.ast, null, 2));
} catch (error) {
  console.error('Parse error:', error);
  process.exit(1);
}