#!/usr/bin/env bun

import { evaluateCompiled } from '../src/compiler';

const args = process.argv.slice(2);

if (args.length < 1) {
  console.error('Usage: bun tools/compiler.ts "<fhirpath-expression>" [input-json]');
  console.error('Examples:');
  console.error('  bun tools/compiler.ts "5 + 3"');
  console.error('  bun tools/compiler.ts "name.given" \'{"name": [{"given": ["John", "James"]}]}\'');
  process.exit(1);
}

const expression = args[0]!;
let input: any = {};

if (args[1]) {
  try {
    input = JSON.parse(args[1]);
  } catch (error) {
    console.error('Invalid JSON input:', error);
    process.exit(1);
  }
}

try {
  const result = evaluateCompiled(expression, input);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error('Compilation/evaluation error:', error);
  process.exit(1);
}