#!/usr/bin/env bun

import { readFileSync } from 'fs';
import { join } from 'path';

const specFunctions = JSON.parse(readFileSync(join(__dirname, 'spec-functions.json'), 'utf-8'));

function findOperation(name: string) {
  return specFunctions.filter((op: any) => 
    op.operation.toLowerCase() === name.toLowerCase() ||
    op.operation === name
  );
}

function extractOperationText(filePath: string, startLine: number): string {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  if (startLine > lines.length) {
    return 'Line number exceeds file length';
  }
  
  const result: string[] = [];
  let inCodeBlock = false;
  let foundEnd = false;
  
  // Start from the operation definition line
  for (let i = startLine - 1; i < lines.length && !foundEnd; i++) {
    const line = lines[i];
    
    // Check if we're entering or exiting a code block
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
    }
    
    // Check for next operation (usually starts with ### or ## followed by a number)
    if (i > startLine - 1 && !inCodeBlock) {
      if (line.match(/^#{2,3}\s+\d+\.\d+/) || 
          line.match(/^#{2,3}\s+\d+\s+/) ||
          (line.match(/^#{2,3}\s+/) && lines[i + 1] && lines[i + 1].trim() === '')) {
        // Found next section, stop here
        foundEnd = true;
        break;
      }
    }
    
    result.push(line);
  }
  
  // Trim empty lines from the end
  while (result.length > 0 && result[result.length - 1].trim() === '') {
    result.pop();
  }
  
  return result.join('\n');
}

function printOperationInfo(operation: string) {
  const matches = findOperation(operation);
  
  if (matches.length === 0) {
    console.log(`No operation found matching: ${operation}`);
    console.log('\nTry one of these similar operations:');
    
    // Suggest similar operations
    const similar = specFunctions
      .filter((op: any) => 
        op.operation.toLowerCase().includes(operation.toLowerCase()) ||
        operation.toLowerCase().includes(op.operation.toLowerCase())
      )
      .slice(0, 5);
    
    if (similar.length > 0) {
      similar.forEach((op: any) => {
        console.log(`  - ${op.operation}`);
      });
    } else {
      console.log('  No similar operations found.');
    }
    return;
  }
  
  matches.forEach((match: any, index: number) => {
    if (matches.length > 1 && index > 0) {
      console.log('\n' + '='.repeat(80) + '\n');
    }
    
    console.log(`Operation: ${match.operation}`);
    console.log(`Spec File: ${match.spec}`);
    console.log(`Line: ${match.line}`);
    console.log('\n--- Specification ---\n');
    
    const specPath = join(__dirname, '..', 'spec', match.spec);
    try {
      const specText = extractOperationText(specPath, match.line);
      console.log(specText);
    } catch (error) {
      console.error(`Error reading spec file: ${error}`);
    }
  });
}

function listOperations() {
  console.log('Available FHIRPath Operations:\n');
  
  const grouped: { [key: string]: string[] } = {};
  
  specFunctions.forEach((op: any) => {
    if (!grouped[op.spec]) {
      grouped[op.spec] = [];
    }
    grouped[op.spec].push(op.operation);
  });
  
  Object.entries(grouped).forEach(([spec, ops]) => {
    console.log(`\n${spec}:`);
    console.log('  ' + ops.join(', '));
  });
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: bun tools/spec-info.ts <operation-name>');
  console.log('       bun tools/spec-info.ts --list');
  console.log('\nExamples:');
  console.log('  bun tools/spec-info.ts where');
  console.log('  bun tools/spec-info.ts +');
  console.log('  bun tools/spec-info.ts "[]"');
  console.log('  bun tools/spec-info.ts --list');
  process.exit(1);
}

if (args[0] === '--list') {
  listOperations();
} else {
  printOperationInfo(args[0]);
}