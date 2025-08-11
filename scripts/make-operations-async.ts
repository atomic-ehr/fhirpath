#!/usr/bin/env bun
/**
 * Script to make all operation evaluators async
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

const operationsDir = join(__dirname, '../src/operations');

// Find all operation files
const files = glob.sync('*.ts', { cwd: operationsDir });

let updatedCount = 0;

for (const file of files) {
  const filePath = join(operationsDir, file);
  let content = readFileSync(filePath, 'utf-8');
  let modified = false;
  
  // Update FunctionEvaluator declarations
  if (content.includes('export const evaluate: FunctionEvaluator = (')) {
    content = content.replace(
      /export const evaluate: FunctionEvaluator = \(/g,
      'export const evaluate: FunctionEvaluator = async ('
    );
    modified = true;
  }
  
  // Update OperationEvaluator declarations
  if (content.includes('export const evaluate: OperationEvaluator = (')) {
    content = content.replace(
      /export const evaluate: OperationEvaluator = \(/g,
      'export const evaluate: OperationEvaluator = async ('
    );
    modified = true;
  }
  
  // Update evaluator calls to use await
  if (content.includes('evaluator(')) {
    // Add await before evaluator calls (not in type definitions)
    content = content.replace(
      /(?<!\/\/.*)(?<!await )evaluator\(/g,
      'await evaluator('
    );
    modified = true;
  }
  
  // Update specific patterns for returns in map/filter callbacks
  if (content.includes('.map(') || content.includes('.filter(')) {
    // Make arrow functions in map/filter async if they contain evaluator
    content = content.replace(
      /\.map\((\w+) => \{/g,
      '.map(async $1 => {'
    );
    content = content.replace(
      /\.filter\((\w+) => \{/g,
      '.filter(async $1 => {'
    );
    
    // Wrap map/filter with Promise.all if they're async
    content = content.replace(
      /const (\w+) = (\w+)\.map\(async/g,
      'const $1 = await Promise.all($2.map(async'
    );
    content = content.replace(
      /const (\w+) = (\w+)\.filter\(async/g,
      'const $1 = await Promise.all($2.filter(async'
    );
    
    // Add closing parenthesis for Promise.all
    if (content.includes('await Promise.all(')) {
      // This is tricky - would need more sophisticated parsing
      // For now, we'll handle this manually in specific files
    }
  }
  
  if (modified) {
    writeFileSync(filePath, content, 'utf-8');
    updatedCount++;
    console.log(`Updated: ${file}`);
  }
}

console.log(`\nTotal files updated: ${updatedCount}`);