#!/usr/bin/env bun

import { Parser, pprint, type ParseResult } from '../src/parser';
import type { ASTNode } from '../src/parser';

let expression = process.argv[2];
const options = process.argv.slice(3).join(' ');

async function getExpression(): Promise<string> {
  if (expression === '-') {
    // Read from stdin
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString().trim();
  }
  return expression || 'UPS';
}

if (!expression) {
  console.error('Usage: bun tools/parser.ts "<expression>" [options]');
  console.error('       echo "<expression>" | bun tools/parser.ts - [options]');
  console.error('Options:');
  console.error('  --lsp          Use LSP parser with error recovery');
  console.error('  --with-errors  Include errors in output');
  console.error('  --lisp         Output in Lisp-style format');
  console.error('  --pprint       Pretty print in Lisp-style format');
  process.exit(1);
}

// Parse options from command line
const useLSP = options?.includes('--lsp');
const withErrors = options?.includes('--with-errors');
const useLisp = options?.includes('--lisp') || options?.includes('--pprint');

// Function to clean up AST for serialization
function cleanAST(node: any, visited = new WeakSet()): any {
  if (!node || typeof node !== 'object') {
    return node;
  }
  
  // Check if we've already visited this node
  if (visited.has(node)) {
    return { circular: true, id: node.id || 'unknown' };
  }
  visited.add(node);
  
  if (Array.isArray(node)) {
    return node.map(n => cleanAST(n, visited));
  }
  
  const cleaned: any = {};
  for (const [key, value] of Object.entries(node)) {
    // Skip parent references and other properties that cause cycles
    if (key === 'parent' || key === 'previousSibling' || key === 'nextSibling') {
      continue;
    }
    // Recursively clean nested objects
    cleaned[key] = cleanAST(value, visited);
  }
  return cleaned;
}

async function main() {
  try {
    expression = await getExpression();
    
    if (useLSP || withErrors) {
      // Use parser in LSP mode which includes error information
      const parser = new Parser(expression, { mode: 'lsp', errorRecovery: true });
      const result = parser.parse();
      
      if (useLisp) {
        console.log('AST:');
        console.log(pprint(result.ast));
        if (result.errors.length > 0) {
          console.log('\nErrors:');
          result.errors.forEach(err => {
            console.log(`  - ${err.message} at position ${err.position?.offset ?? 'unknown'}`);
          });
        }
      } else {
        // Clean the AST to remove circular references for JSON output
        const output = {
          ast: cleanAST(result.ast),
          errors: result.errors
        };
        console.log(JSON.stringify(output, null, 2));
      }
    } else {
      // Use regular parser which throws on errors
      const parser = new Parser(expression);
      const result = parser.parse();
      
      // Check for errors and throw if present (for backward compatibility)
      if (result.errors.length > 0) {
        throw new Error(result.errors[0]!.message);
      }
      
      if (useLisp) {
        console.log(pprint(result.ast));
      } else {
        console.log(JSON.stringify(result.ast, null, 2));
      }
    }
  } catch (error: any) {
    console.error('Parse error:', error.message);
    process.exit(1);
  }
}

main();