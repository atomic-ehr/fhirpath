#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { registry } from '../src/registry';
import { execSync } from 'child_process';

interface AnalysisResult {
  name: string;
  type: 'function' | 'operator';
  implemented: boolean;
  implementationFile: string | null;
  testFiles: string[];
  testCoverage: 'full' | 'partial' | 'none';
  registryEntry: any | null;
  notes: string;
}

function findImplementationFile(name: string, type: 'function' | 'operator'): string | null {
  const operationsDir = join(__dirname, '../src/operations');
  
  // Common filename patterns
  const possibleNames = [
    `${name}.ts`,
    `${name}-function.ts`,
    `${name}-operator.ts`,
    `${name.toLowerCase()}.ts`,
    `${name.toLowerCase()}-function.ts`,
    `${name.toLowerCase()}-operator.ts`,
    `${name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')}.ts`,
    `${name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')}-function.ts`,
    `${name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')}-operator.ts`
  ];
  
  // Special mappings for operators
  if (type === 'operator') {
    const operatorMappings: Record<string, string> = {
      '+': 'plus-operator.ts',
      '-': 'minus-operator.ts',
      '*': 'multiply-operator.ts',
      '/': 'divide-operator.ts',
      '=': 'equals-operator.ts',
      '!=': 'not-equals-operator.ts',
      '<': 'less-than-operator.ts',
      '>': 'greater-than-operator.ts',
      '<=': 'less-than-or-equals-operator.ts',
      '>=': 'greater-than-or-equals-operator.ts',
      '~': 'equivalent-operator.ts',
      '!~': 'not-equivalent-operator.ts',
      '&': 'concatenate-operator.ts',
      '|': 'union-operator.ts',
      '.': 'dot-operator.ts',
      '[]': 'indexer-operator.ts',
      'and': 'and-operator.ts',
      'or': 'or-operator.ts',
      'xor': 'xor-operator.ts',
      'implies': 'implies-operator.ts',
      'as': 'as-operator.ts',
      'is': 'is-operator.ts',
      'div': 'div-operator.ts',
      'mod': 'mod-operator.ts',
      'contains': 'contains-operator.ts',
      'in': 'in-operator.ts'
    };
    
    if (operatorMappings[name]) {
      possibleNames.unshift(operatorMappings[name]);
    }
  }
  
  // Check each possible filename
  for (const filename of possibleNames) {
    const filepath = join(operationsDir, filename);
    if (existsSync(filepath)) {
      return `operations/${filename}`;
    }
  }
  
  // Search in operations directory
  try {
    const files = readdirSync(operationsDir);
    for (const file of files) {
      if (file.endsWith('.ts')) {
        const content = readFileSync(join(operationsDir, file), 'utf-8');
        // Check if file contains the function/operator name
        if (content.includes(`'${name}'`) || 
            content.includes(`"${name}"`) ||
            content.includes(`name: '${name}'`) ||
            content.includes(`symbol: '${name}'`)) {
          return `operations/${file}`;
        }
      }
    }
  } catch (e) {
    // Directory might not exist
  }
  
  return null;
}

function findTestFiles(name: string): string[] {
  const testFiles: string[] = [];
  
  // Search in test directory
  try {
    const testDir = join(__dirname, '../test');
    const result = execSync(
      `grep -r "${name}" ${testDir} --include="*.test.ts" -l 2>/dev/null || true`,
      { encoding: 'utf-8' }
    );
    
    if (result) {
      const files = result.split('\n').filter(f => f);
      testFiles.push(...files.map(f => f.replace(/^.*\/test\//, 'test/')));
    }
  } catch (e) {
    // grep might fail
  }
  
  // Search in test-cases directory
  try {
    const testCasesDir = join(__dirname, '../test-cases');
    
    // Look for specific test case files
    const possibleTestFiles = [
      `operations/${name}.json`,
      `operations/arithmetic/${name}.json`,
      `operations/logical/${name}.json`,
      `operations/string/${name}.json`,
      `operations/utility/${name}.json`,
      `operations/existence/${name}.json`,
      `operations/filtering/${name}.json`,
      `operations/math/${name}.json`,
      `functions/${name}.json`
    ];
    
    for (const testFile of possibleTestFiles) {
      const fullPath = join(testCasesDir, testFile);
      if (existsSync(fullPath)) {
        testFiles.push(`test-cases/${testFile}`);
      }
    }
    
    // Also search for mentions in test case files
    const result = execSync(
      `grep -r '"${name}"\\|"expression".*${name}' ${testCasesDir} --include="*.json" -l 2>/dev/null || true`,
      { encoding: 'utf-8' }
    );
    
    if (result) {
      const files = result.split('\n').filter(f => f);
      for (const file of files) {
        const relative = file.replace(/^.*\/test-cases\//, 'test-cases/');
        if (!testFiles.includes(relative)) {
          testFiles.push(relative);
        }
      }
    }
  } catch (e) {
    // grep might fail
  }
  
  return testFiles;
}

function determineTestCoverage(testFiles: string[], implemented: boolean): 'full' | 'partial' | 'none' {
  if (!implemented) return 'none';
  if (testFiles.length === 0) return 'none';
  
  // Check if we have both unit tests and test cases
  const hasUnitTests = testFiles.some(f => f.startsWith('test/'));
  const hasTestCases = testFiles.some(f => f.startsWith('test-cases/'));
  
  if (hasUnitTests && hasTestCases) return 'full';
  if (hasUnitTests || hasTestCases) return 'partial';
  
  return 'none';
}

function analyzeItem(name: string, type: 'function' | 'operator' = 'function'): AnalysisResult {
  // Check registry
  let registryEntry = null;
  try {
    registryEntry = registry.getOperation(name);
  } catch (e) {
    // Not in registry
  }
  
  // Find implementation
  const implementationFile = findImplementationFile(name, type);
  const implemented = !!implementationFile || !!registryEntry;
  
  // Find tests
  const testFiles = findTestFiles(name);
  const testCoverage = determineTestCoverage(testFiles, implemented);
  
  // Determine notes
  let notes = '';
  if (implemented && testCoverage === 'none') {
    notes = 'Implemented but no tests found';
  } else if (!implemented) {
    notes = 'Not implemented';
  } else if (registryEntry && !implementationFile) {
    notes = 'In registry but implementation file not found';
  }
  
  return {
    name,
    type,
    implemented,
    implementationFile,
    testFiles,
    testCoverage,
    registryEntry: registryEntry ? {
      type: registryEntry.type,
      category: registryEntry.category,
      precedence: registryEntry.precedence
    } : null,
    notes
  };
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: bun tools/analyze-implementation.ts <name> [type]');
    console.error('  name: Function or operator name');
    console.error('  type: "function" or "operator" (default: "function")');
    process.exit(1);
  }
  
  const name = args[0];
  const type = (args[1] as 'function' | 'operator') || 'function';
  
  const result = analyzeItem(name, type);
  console.log(JSON.stringify(result, null, 2));
}

// Export for use by other tools
export { analyzeItem, AnalysisResult };

// Run if called directly
if (import.meta.main) {
  main();
}