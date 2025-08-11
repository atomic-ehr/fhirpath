#!/usr/bin/env bun
/**
 * Script to make all test files async
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

const testDir = join(__dirname, '../test');

// Find all test files
const files = glob.sync('**/*.test.ts', { cwd: testDir });

let updatedCount = 0;

for (const file of files) {
  const filePath = join(testDir, file);
  let content = readFileSync(filePath, 'utf-8');
  let modified = false;
  
  // Update evaluate function calls to use await
  // Match patterns like: expect(evaluate(...))
  content = content.replace(
    /expect\(evaluate\(/g,
    'expect(await evaluate('
  );
  
  // Update test functions to be async
  // Match: it('...', () => {
  content = content.replace(
    /it\((['"`][^'"`]*['"`]),\s*\(\)\s*=>\s*\{/g,
    'it($1, async () => {'
  );
  
  // Also update test functions with function keyword
  // Match: it('...', function() {
  content = content.replace(
    /it\((['"`][^'"`]*['"`]),\s*function\s*\(\)\s*\{/g,
    'it($1, async function() {'
  );
  
  // Update describe callbacks that use evaluate
  if (content.includes('evaluate(')) {
    // Make test helper functions async
    content = content.replace(
      /function evaluate\(/g,
      'async function evaluate('
    );
    
    // Add await to interpreter.evaluate calls
    content = content.replace(
      /const result = interpreter\.evaluate\(/g,
      'const result = await interpreter.evaluate('
    );
    
    // Add await to calls in test-cases.test.ts
    content = content.replace(
      /const result = evaluate\(/g,
      'const result = await evaluate('
    );
    
    // Fix patterns like: evaluate(test.expression, options)
    if (!content.includes('await evaluate(')) {
      content = content.replace(
        /([^a-zA-Z])evaluate\(/g,
        '$1await evaluate('
      );
    }
    
    modified = true;
  }
  
  // Check if modifications were made
  if (content.includes('await evaluate(') && !content.includes('async')) {
    modified = true;
  }
  
  if (modified || content !== readFileSync(filePath, 'utf-8')) {
    writeFileSync(filePath, content, 'utf-8');
    updatedCount++;
    console.log(`Updated: ${file}`);
  }
}

console.log(`\nTotal test files updated: ${updatedCount}`);