#!/usr/bin/env bun

// TODO: Replace with new inspect implementation
// import { inspect } from '../legacy-src/api';
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
  --max-traces  Maximum number of traces to collect (default: unlimited)
  --verbose     Show full trace values (default: truncated)
  --ast         Show only the AST
  --traces      Show only traces
  --timing      Show only timing information
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
let maxTraces: number | undefined;
let verbose = false;
let showOnlyAst = false;
let showOnlyTraces = false;
let showOnlyTiming = false;

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
  } else if (arg === '--max-traces') {
    i++;
    if (i < args.length) {
      maxTraces = parseInt(args[i]!);
      if (isNaN(maxTraces)) {
        console.error('Invalid max-traces value');
        process.exit(1);
      }
    }
  } else if (arg === '--verbose') {
    verbose = true;
  } else if (arg === '--ast') {
    showOnlyAst = true;
  } else if (arg === '--traces') {
    showOnlyTraces = true;
  } else if (arg === '--timing') {
    showOnlyTiming = true;
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

// TODO: Implement inspect with new API
console.error('inspect tool needs to be updated for the new API');
process.exit(1);

/*
try {
  // Run inspect
  const result = inspect(
    expression!,
    inputData,
    { variables },
    { maxTraces }
  );
  */
  
  /*
  // Display results based on options
  if (showOnlyAst) {
    console.log('AST:');
    console.log(formatAst(result.ast));
  } else if (showOnlyTraces) {
    if (result.traces.length === 0) {
      console.log('No traces captured');
    } else {
      console.log(`Traces (${result.traces.length}):`);
      result.traces.forEach((trace, i) => {
        console.log(`\n[${i + 1}] ${trace.name} at ${trace.timestamp.toFixed(3)}ms (depth: ${trace.depth})`);
        console.log(`    Values: ${formatValue(trace.values)}`);
      });
    }
  } else if (showOnlyTiming) {
    console.log(`Execution time: ${result.executionTime.toFixed(3)}ms`);
  } else {
    // Show everything
    console.log('=== FHIRPath Expression Inspection ===\n');
    
    console.log(`Expression: ${result.expression}`);
    console.log(`Result: ${formatValue(result.result)}`);
    console.log(`Execution time: ${result.executionTime.toFixed(3)}ms`);
    
    if (result.errors && result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((error, i) => {
        console.log(`  [${i + 1}] ${error.type}: ${error.message}`);
        if (error.location) {
          console.log(`      at line ${error.location.line}, column ${error.location.column}`);
        }
      });
    }
    
    if (result.warnings && result.warnings.length > 0) {
      console.log('\nWarnings:');
      result.warnings.forEach((warning, i) => {
        console.log(`  [${i + 1}] ${warning.code}: ${warning.message}`);
      });
    }
    
    if (result.traces.length > 0) {
      console.log(`\nTraces (${result.traces.length}):`);
      result.traces.forEach((trace, i) => {
        console.log(`  [${i + 1}] ${trace.name} at ${trace.timestamp.toFixed(3)}ms (depth: ${trace.depth})`);
        if (verbose || trace.values.length <= 3) {
          console.log(`      Values: ${formatValue(trace.values)}`);
        } else {
          console.log(`      Values: ${trace.values.length} items`);
        }
      });
    }
    
    if (verbose) {
      console.log('\nAST:');
      console.log(formatAst(result.ast));
    }
  }
  
  // Exit with appropriate code
  if (result.errors && result.errors.length > 0) {
    process.exit(1);
  }
  
} catch (error) {
  console.error('Inspection failed:', error);
  process.exit(1);
}
*/