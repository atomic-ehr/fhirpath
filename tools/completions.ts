#!/usr/bin/env bun

/**
 * FHIRPath Completions Testing Tool
 * 
 * Test code completions for FHIRPath expressions at a specific cursor position.
 * 
 * Usage:
 *   bun tools/completions.ts "<expression>" <cursor-position> [options]
 * 
 * Examples:
 *   bun tools/completions.ts "Patient." 8
 *   bun tools/completions.ts "Patient.na" 10
 *   bun tools/completions.ts "5 + " 4
 *   bun tools/completions.ts "name.where(" 11
 *   bun tools/completions.ts "value is " 9
 *   bun tools/completions.ts "Patient." 8 --type Patient
 *   bun tools/completions.ts "Patient.name." 13 --model
 *   bun tools/completions.ts "where(" 6 --vars '{"x": 10}'
 */

import { provideCompletions, CompletionKind } from '../src/completion-provider';
import type { CompletionItem, CompletionOptions } from '../src/completion-provider';
import type { TypeInfo } from '../src/types';
import { getInitializedModelProvider } from '../test/model-provider-singleton';
import { parseArgs } from 'util';

// Parse command line arguments
const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    help: { type: 'boolean', short: 'h' },
    type: { type: 'string', short: 't' },
    model: { type: 'boolean', short: 'm' },
    vars: { type: 'string', short: 'v' },
    filter: { type: 'string', short: 'f' },
    limit: { type: 'string', short: 'l' },
    json: { type: 'boolean', short: 'j' },
    kind: { type: 'string', short: 'k' },
    verbose: { type: 'boolean' }
  },
  strict: true,
  allowPositionals: true,
});

// Show help
if (values.help || positionals.length < 4) {
  console.log(`
FHIRPath Completions Testing Tool

Test code completions for FHIRPath expressions at a specific cursor position.

Usage:
  bun tools/completions.ts "<expression>" <cursor-position> [options]

Arguments:
  expression       The FHIRPath expression (use | for cursor position)
  cursor-position  The cursor position (0-based index)

Options:
  -h, --help       Show this help message
  -t, --type       Input type (e.g., Patient, Observation)
  -m, --model      Use FHIR model provider for resource-aware completions
  -v, --vars       Variables as JSON (e.g., '{"x": 10, "y": "test"}')
  -f, --filter     Filter completions by prefix
  -l, --limit      Maximum number of completions to show (default: all)
  -j, --json       Output as JSON
  -k, --kind       Filter by completion kind (property|function|variable|operator|type|constant)
  --verbose        Show detailed information

Examples:
  # Basic completions after dot
  bun tools/completions.ts "Patient." 8
  
  # Filter by partial text
  bun tools/completions.ts "Patient.na" 10
  
  # Operator completions
  bun tools/completions.ts "5 + " 4
  
  # Function argument completions
  bun tools/completions.ts "name.where(" 11
  
  # Type completions
  bun tools/completions.ts "value is " 9
  
  # With input type
  bun tools/completions.ts "Patient." 8 --type Patient
  
  # With FHIR model provider
  bun tools/completions.ts "Patient.name." 13 --model
  
  # With variables
  bun tools/completions.ts "where(" 6 --vars '{"x": 10}'
  
  # Filter by kind
  bun tools/completions.ts "Patient." 8 --kind function
  
  # Using | for cursor position (cursor at |)
  bun tools/completions.ts "Patient.|" 
  bun tools/completions.ts "Patient.na|me"
  
  # Output as JSON
  bun tools/completions.ts "Patient." 8 --json
`);
  process.exit(0);
}

// Get expression and cursor position
let expression = positionals[2];
let cursorPosition = parseInt(positionals[3]);

// Handle pipe character for cursor position
if (expression.includes('|')) {
  cursorPosition = expression.indexOf('|');
  expression = expression.replace('|', '');
}

// Validate cursor position
if (isNaN(cursorPosition) || cursorPosition < 0 || cursorPosition > expression.length) {
  console.error(`Error: Invalid cursor position ${positionals[3]}. Must be between 0 and ${expression.length}`);
  process.exit(1);
}

// Build options
const options: CompletionOptions = {};

// Add input type if specified
if (values.type) {
  options.inputType = { type: values.type as any, singleton: true };
}

// Add model provider if requested
if (values.model) {
  options.modelProvider = await getInitializedModelProvider();
}

// Add variables if specified
if (values.vars) {
  try {
    options.variables = JSON.parse(values.vars);
  } catch (e) {
    console.error('Error: Invalid JSON for variables:', e.message);
    process.exit(1);
  }
}

// Add limit if specified
if (values.limit) {
  options.maxCompletions = parseInt(values.limit);
  if (isNaN(options.maxCompletions)) {
    console.error('Error: Invalid limit value');
    process.exit(1);
  }
}

// Get completions
let completions: CompletionItem[] = [];
try {
  completions = provideCompletions(expression, cursorPosition, options);
} catch (error) {
  console.error('Error getting completions:', error.message);
  process.exit(1);
}

// Filter by prefix if specified
if (values.filter) {
  const prefix = values.filter.toLowerCase();
  completions = completions.filter(c => c.label.toLowerCase().startsWith(prefix));
}

// Filter by kind if specified
if (values.kind) {
  const kindFilter = values.kind.toLowerCase();
  const kindMap: Record<string, CompletionKind> = {
    'property': CompletionKind.Property,
    'function': CompletionKind.Function,
    'variable': CompletionKind.Variable,
    'operator': CompletionKind.Operator,
    'type': CompletionKind.Type,
    'keyword': CompletionKind.Keyword,
    'constant': CompletionKind.Constant
  };
  
  if (kindFilter in kindMap) {
    completions = completions.filter(c => c.kind === kindMap[kindFilter]);
  } else {
    console.error(`Error: Invalid kind '${values.kind}'. Valid kinds: ${Object.keys(kindMap).join(', ')}`);
    process.exit(1);
  }
}

// Output results
if (values.json) {
  // JSON output
  console.log(JSON.stringify(completions, null, 2));
} else {
  // Human-readable output
  
  // Show expression with cursor marker
  const expressionWithCursor = 
    expression.slice(0, cursorPosition) + '|' + expression.slice(cursorPosition);
  
  console.log('\n' + '='.repeat(60));
  console.log('Expression:', expressionWithCursor);
  console.log('Position:  ', cursorPosition);
  if (values.type) {
    console.log('Input Type:', values.type);
  }
  if (values.vars) {
    console.log('Variables: ', values.vars);
  }
  console.log('='.repeat(60));
  
  if (completions.length === 0) {
    console.log('\nNo completions available at this position.');
  } else {
    console.log(`\nFound ${completions.length} completion(s):\n`);
    
    // Group by kind
    const byKind = new Map<CompletionKind, CompletionItem[]>();
    for (const item of completions) {
      if (!byKind.has(item.kind)) {
        byKind.set(item.kind, []);
      }
      byKind.get(item.kind)!.push(item);
    }
    
    // Display grouped completions
    const kindOrder = [
      CompletionKind.Property,
      CompletionKind.Variable,
      CompletionKind.Function,
      CompletionKind.Operator,
      CompletionKind.Type,
      CompletionKind.Keyword,
      CompletionKind.Constant
    ];
    
    for (const kind of kindOrder) {
      const items = byKind.get(kind);
      if (!items || items.length === 0) continue;
      
      console.log(`${kind.toUpperCase()}S (${items.length}):`);
      console.log('-'.repeat(40));
      
      for (const item of items) {
        if (values.verbose) {
          console.log(`  ${item.label}`);
          if (item.detail) {
            console.log(`    Detail: ${item.detail}`);
          }
          if (item.documentation) {
            console.log(`    Docs:   ${item.documentation}`);
          }
          if (item.insertText && item.insertText !== item.label) {
            console.log(`    Insert: ${item.insertText}`);
          }
          console.log();
        } else {
          const detail = item.detail ? ` - ${item.detail}` : '';
          const insert = item.insertText && item.insertText !== item.label 
            ? ` [${item.insertText}]` : '';
          console.log(`  ${item.label}${detail}${insert}`);
        }
      }
      console.log();
    }
  }
}

// Summary statistics
if (!values.json && completions.length > 0) {
  const stats = new Map<CompletionKind, number>();
  for (const item of completions) {
    stats.set(item.kind, (stats.get(item.kind) || 0) + 1);
  }
  
  console.log('Summary:');
  console.log('-'.repeat(40));
  for (const [kind, count] of stats) {
    console.log(`  ${kind}: ${count}`);
  }
  console.log(`  Total: ${completions.length}`);
}