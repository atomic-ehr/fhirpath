#!/usr/bin/env bun

import { Parser } from '../src/parser';
import { Interpreter } from '../src/interpreter';

const expression = process.argv[2];
const inputJson = process.argv[3];

if (!expression) {
  console.error('Usage: bun tools/interpreter.ts "<expression>" [input-json]');
  console.error('Examples:');
  console.error('  bun tools/interpreter.ts "5 + 3"');
  console.error('  bun tools/interpreter.ts "name.given" \'{"name": [{"given": ["John", "James"]}]}\'');
  console.error('  bun tools/interpreter.ts "name.where(use = \'official\').given" \'{"name": [{"use": "official", "given": ["John"]}]}\'');
  process.exit(1);
}

try {
  // Parse the expression
  const parser = new Parser(expression);
  const ast = parser.parse();
  
  // Parse input if provided
  let input: any = [];
  if (inputJson) {
    try {
      const parsed = JSON.parse(inputJson);
      input = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      console.error('Invalid JSON input:', e);
      process.exit(1);
    }
  }
  
  // Evaluate the expression
  const interpreter = new Interpreter();
  const result = interpreter.evaluate(ast, input);
  
  // Output the result
  console.log(JSON.stringify(result.value, null, 2));
  
} catch (error: any) {
  console.error('Error:', error.message);
  process.exit(1);
}