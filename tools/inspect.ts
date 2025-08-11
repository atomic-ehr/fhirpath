#!/usr/bin/env bun

import { inspect } from '../src/inspect';
import { readFileSync } from 'fs';

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
FHIRPath Inspect Tool - Debug FHIRPath expressions with trace information

Usage:
  bun tools/inspect.ts "<expression>" [input-json] [options]

Arguments:
  expression    FHIRPath expression to inspect (required)
  input-json    Input data as JSON string or @filename (optional)
  
Options:
  --vars, -v    JSON object with variables (e.g., '{"x": 10}')
  --max-depth   Maximum AST depth to analyze (default: 100)
  --verbose     Show full trace values (default: truncated)
  --ast         Show only the AST
  --traces      Show only traces
  --timing      Show only timing information
  --diagnostics Show diagnostics (warnings and hints)
  --help, -h    Show this help message

Examples:
  # Simple expression
  bun tools/inspect.ts "5 + 3"

  # With trace calls
  bun tools/inspect.ts "name.trace('names').given.trace('given names')" '{"name": [{"given": ["John"]}]}'

  # With input from file
  bun tools/inspect.ts "Patient.name.given" @patient.json

  # With variables
  bun tools/inspect.ts "%x + %y" --vars '{"x": 10, "y": 20}'

  # Limit traces
  bun tools/inspect.ts "items.trace('item')" @data.json --max-traces 10

  # Show only specific information
  bun tools/inspect.ts "complex.expression" @data.json --traces
  bun tools/inspect.ts "complex.expression" @data.json --timing
`);
  process.exit(0);
}

// Parse arguments
const expression = args[0];
let inputData: any = undefined;
let variables: Record<string, any> = {};
let maxDepth = 100;
let verbose = false;
let showOnlyAst = false;
let showOnlyTraces = false;
let showOnlyTiming = false;
let showDiagnostics = false;
let includeTraces = false;

// Process remaining arguments
for (let i = 1; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--vars' || arg === '-v') {
    i++;
    if (i < args.length) {
      try {
        variables = JSON.parse(args[i]!);
      } catch (e) {
        console.error(`Error parsing variables: ${e}`);
        process.exit(1);
      }
    }
  } else if (arg === '--max-depth') {
    i++;
    if (i < args.length) {
      maxDepth = parseInt(args[i]!);
      if (isNaN(maxDepth)) {
        console.error('Invalid max-depth value');
        process.exit(1);
      }
    }
  } else if (arg === '--verbose') {
    verbose = true;
  } else if (arg === '--ast') {
    showOnlyAst = true;
  } else if (arg === '--traces') {
    showOnlyTraces = true;
    includeTraces = true;
  } else if (arg === '--timing') {
    showOnlyTiming = true;
  } else if (arg === '--diagnostics') {
    showDiagnostics = true;
  } else if (!inputData && i === 1) {
    // This is the input data argument
    if (arg && arg.startsWith('@')) {
      // Read from file
      const filename = arg.substring(1);
      try {
        const fileContent = readFileSync(filename, 'utf-8');
        inputData = JSON.parse(fileContent);
      } catch (e) {
        console.error(`Error reading file ${filename}: ${e}`);
        process.exit(1);
      }
    } else {
      // Parse as JSON
      try {
        inputData = JSON.parse(arg!);
      } catch (e) {
        console.error(`Error parsing input JSON: ${e}`);
        process.exit(1);
      }
    }
  }
}

// Helper function to truncate long values
function formatValue(value: any, maxLength = 80): string {
  const str = JSON.stringify(value, null, 2);
  if (!verbose && str.length > maxLength) {
    return str.substring(0, maxLength - 3) + '...';
  }
  return str;
}

// Helper function to format AST metadata
function formatMetadata(metadata: any): string {
  const lines: string[] = [];
  lines.push(`  Complexity: ${metadata.complexity}`);
  lines.push(`  Depth: ${metadata.depth}`);
  if (metadata.operationCount.size > 0) {
    lines.push('  Operations:');
    for (const [op, count] of metadata.operationCount) {
      lines.push(`    ${op}: ${count}`);
    }
  }
  return lines.join('\n');
}

// Helper function to format AST with colors
function formatAst(node: any, indent = 0): string {
  const spaces = ' '.repeat(indent);
  const typeColor = '\x1b[36m'; // Cyan
  const nameColor = '\x1b[33m'; // Yellow
  const valueColor = '\x1b[32m'; // Green
  const reset = '\x1b[0m';
  
  if (!node) return `${spaces}null`;
  
  let result = `${spaces}${typeColor}${node.type || 'unknown'}${reset}`;
  
  if (node.name) {
    result += ` ${nameColor}${node.name}${reset}`;
  }
  if (node.value !== undefined) {
    result += ` ${valueColor}${JSON.stringify(node.value)}${reset}`;
  }
  if (node.operator) {
    result += ` ${nameColor}${node.operator}${reset}`;
  }
  
  // Handle child nodes
  const childProps = ['left', 'right', 'operand', 'arguments', 'elements', 'expression'];
  for (const prop of childProps) {
    if (node[prop]) {
      result += '\n';
      if (Array.isArray(node[prop])) {
        for (const child of node[prop]) {
          result += formatAst(child, indent + 2) + '\n';
        }
      } else {
        result += formatAst(node[prop], indent + 2);
      }
    }
  }
  
  return result.trimEnd();
}

async function main() {
  try {
    // Check if expression contains trace() to automatically enable trace collection
    if (expression!.includes('trace(')) {
      includeTraces = true;
    }
    
    // Run inspect
    const result = await inspect(expression!, {
      input: inputData,
      variables,
      maxDepth,
      includeTraces
    });
  
  // Display results based on options
  if (showOnlyAst) {
    console.log('AST:');
    console.log(formatAst(result.ast.node));
    console.log('\nAST Metadata:');
    console.log(formatMetadata(result.ast.metadata));
  } else if (showOnlyTraces) {
    if (!result.traces || result.traces.length === 0) {
      console.log('No traces captured (use trace() function in expression)');
    } else {
      console.log(`Traces (${result.traces.length}):`);
      result.traces.forEach((trace, i) => {
        console.log(`\n[${i + 1}] ${trace.label} at ${trace.timestamp.toFixed(3)}ms`);
        console.log(`    Values: ${formatValue(trace.value)}`);
      });
    }
  } else if (showOnlyTiming) {
    console.log('Performance Metrics:');
    console.log(`  Parse time: ${result.performance.parseTime.toFixed(3)}ms`);
    console.log(`  Analyze time: ${result.performance.analyzeTime.toFixed(3)}ms`);
    console.log(`  Eval time: ${result.performance.evalTime.toFixed(3)}ms`);
    console.log(`  Total time: ${result.performance.totalTime.toFixed(3)}ms`);
    
    if (result.performance.operationTimings.size > 0) {
      console.log('\nOperation Timings:');
      const sorted = Array.from(result.performance.operationTimings.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      for (const [op, time] of sorted) {
        console.log(`  ${op}: ${time.toFixed(3)}ms`);
      }
    }
  } else if (showDiagnostics) {
    console.log('Diagnostics:\n');
    
    if (result.diagnostics.warnings.length > 0) {
      console.log('Warnings:');
      result.diagnostics.warnings.forEach(w => {
        console.log(`  - ${w.message}`);
      });
    }
    
    if (result.diagnostics.hints.length > 0) {
      console.log('\nHints:');
      result.diagnostics.hints.forEach(h => {
        console.log(`  - ${h.message}`);
        if (h.suggestion) {
          console.log(`    Suggestion: ${h.suggestion}`);
        }
      });
    }
    
    if (result.diagnostics.warnings.length === 0 && result.diagnostics.hints.length === 0) {
      console.log('No warnings or hints.');
    }
  } else {
    // Show everything
    console.log('=== FHIRPath Expression Inspection ===\n');
    
    console.log(`Expression: ${expression}`);
    console.log(`Result: ${formatValue(result.result)}`);
    console.log(`\nPerformance:`);
    console.log(`  Total time: ${result.performance.totalTime.toFixed(3)}ms`);
    console.log(`  Parse: ${result.performance.parseTime.toFixed(3)}ms`);
    console.log(`  Analyze: ${result.performance.analyzeTime.toFixed(3)}ms`);
    console.log(`  Eval: ${result.performance.evalTime.toFixed(3)}ms`);
    
    // Show AST metadata
    console.log('\nAST Metadata:');
    console.log(formatMetadata(result.ast.metadata));
    
    // Show diagnostics
    if (result.diagnostics.warnings.length > 0) {
      console.log('\nWarnings:');
      result.diagnostics.warnings.forEach((w, i) => {
        console.log(`  [${i + 1}] ${w.message}`);
      });
    }
    
    if (result.diagnostics.hints.length > 0) {
      console.log('\nHints:');
      result.diagnostics.hints.forEach((h, i) => {
        console.log(`  [${i + 1}] ${h.message}`);
        if (h.suggestion) {
          console.log(`      Suggestion: ${h.suggestion}`);
        }
      });
    }
    
    // Show traces if any
    if (result.traces && result.traces.length > 0) {
      console.log(`\nTraces (${result.traces.length}):`);
      result.traces.forEach((trace, i) => {
        console.log(`  [${i + 1}] ${trace.label} at ${trace.timestamp.toFixed(3)}ms`);
        if (verbose || trace.value.length <= 3) {
          console.log(`      Values: ${formatValue(trace.value)}`);
        } else {
          console.log(`      Values: ${trace.value.length} items`);
        }
      });
    }
    
    if (verbose) {
      console.log('\nAST:');
      console.log(formatAst(result.ast.node));
    }
  }
  
  } catch (error) {
    console.error('Inspection failed:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});