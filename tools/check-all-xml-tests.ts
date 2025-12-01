#!/usr/bin/env bun

import * as fs from 'fs';
import * as path from 'path';
import { parseString } from 'xml2js';
import { promisify } from 'util';

const parseXml = promisify(parseString);

interface XmlTest {
  $: {
    name: string;
    description?: string;
    inputfile?: string;
  };
  expression: string[];
  output?: any[];
}

interface XmlGroup {
  $: {
    name: string;
    description?: string;
  };
  test?: XmlTest[];
}

interface XmlTestSuite {
  tests: {
    $: {
      name: string;
      description?: string;
    };
    group: XmlGroup[];
  };
}

// Get all test cases from our JSON test files
function getAllOurTestExpressions(): Set<string> {
  const testCasesDir = path.join(process.cwd(), 'test-cases');
  const expressions = new Set<string>();
  
  function walkDir(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filepath = path.join(dir, file);
      const stat = fs.statSync(filepath);
      if (stat.isDirectory()) {
        walkDir(filepath);
      } else if (file.endsWith('.json')) {
        try {
          const content = fs.readFileSync(filepath, 'utf-8');
          const data = JSON.parse(content);
          if (data.tests && Array.isArray(data.tests)) {
            for (const test of data.tests) {
              if (test.expression) {
                expressions.add(test.expression.trim());
              }
            }
          }
        } catch (e) {
          // Skip invalid JSON files
        }
      }
    }
  }
  
  if (fs.existsSync(testCasesDir)) {
    walkDir(testCasesDir);
  }
  
  return expressions;
}

// Normalize expression for comparison
function normalizeExpression(expr: string): string {
  return expr
    .replace(/\s+/g, ' ')
    .replace(/\s*([(),])\s*/g, '$1')
    .replace(/\s*([+\-*\/=<>!&|])\s*/g, ' $1 ')
    .trim();
}

async function main() {
  const xmlFile = path.join(process.cwd(), 'spec/fhirpathlab-tests/fhirpathlab-tests.xml');
  
  if (!fs.existsSync(xmlFile)) {
    console.error(`XML test file not found: ${xmlFile}`);
    process.exit(1);
  }
  
  const xmlContent = fs.readFileSync(xmlFile, 'utf-8');
  const result = await parseXml(xmlContent) as XmlTestSuite;
  
  const ourExpressions = getAllOurTestExpressions();
  const normalizedOurExpressions = new Set(
    Array.from(ourExpressions).map(e => normalizeExpression(e))
  );
  
  console.log(`Found ${ourExpressions.size} expressions in our test suite`);
  console.log(`Found ${result.tests.group.length} groups in XML test suite\n`);
  console.log('='.repeat(80));
  
  let totalTests = 0;
  let totalMissing = 0;
  let totalFound = 0;
  
  const groupStats: Array<{
    name: string;
    total: number;
    found: number;
    missing: number;
    missingExpressions: string[];
  }> = [];
  
  // Process ALL groups
  for (const group of result.tests.group) {
    const groupName = group.$.name;
    const groupDesc = group.$.description || '';
    const tests = group.test || [];
    
    let groupFound = 0;
    let groupMissing = 0;
    const missingExpressions: string[] = [];
    
    console.log(`\nGroup: ${groupName}`);
    if (groupDesc) {
      console.log(`  Description: ${groupDesc}`);
    }
    console.log(`  Total tests: ${tests.length}`);
    
    for (const test of tests) {
      if (test.expression && test.expression.length > 0) {
        const exprRaw = test.expression[0];
        // Handle both string and object expressions - xml2js might wrap text in an object
        let expr: string;
        if (typeof exprRaw === 'string') {
          expr = exprRaw;
        } else if (exprRaw && typeof exprRaw === 'object' && '_' in exprRaw) {
          expr = (exprRaw as any)._;
        } else if (exprRaw && typeof exprRaw === 'object' && '$value' in exprRaw) {
          expr = (exprRaw as any).$value;
        } else {
          // Skip if invalid - these are marked as invalid in the XML
          continue;
        }
        const normalizedExpr = normalizeExpression(expr);
        totalTests++;
        
        // Check if we have this expression
        const found = ourExpressions.has(expr) || 
                     normalizedOurExpressions.has(normalizedExpr);
        
        if (found) {
          groupFound++;
          totalFound++;
        } else {
          groupMissing++;
          totalMissing++;
          missingExpressions.push(`    - ${test.$.name}: ${expr}`);
        }
      }
    }
    
    const percentage = tests.length > 0 
      ? ((groupFound / tests.length) * 100).toFixed(1)
      : '0.0';
    
    console.log(`  ✓ Found: ${groupFound}/${tests.length} (${percentage}%)`);
    console.log(`  ✗ Missing: ${groupMissing}/${tests.length}`);
    
    if (missingExpressions.length > 0 && missingExpressions.length <= 10) {
      console.log('  Missing expressions:');
      missingExpressions.forEach(expr => console.log(expr));
    } else if (missingExpressions.length > 10) {
      console.log('  Missing expressions (first 10):');
      missingExpressions.slice(0, 10).forEach(expr => console.log(expr));
      console.log(`    ... and ${missingExpressions.length - 10} more`);
    }
    
    groupStats.push({
      name: groupName,
      total: tests.length,
      found: groupFound,
      missing: groupMissing,
      missingExpressions
    });
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY OF ALL GROUPS:');
  console.log('='.repeat(80));
  
  // Sort groups by missing count (descending)
  groupStats.sort((a, b) => b.missing - a.missing);
  
  console.log('\nGroups with most missing tests:');
  groupStats.slice(0, 10).forEach(g => {
    const percentage = g.total > 0 
      ? ((g.found / g.total) * 100).toFixed(1)
      : '0.0';
    console.log(`  ${g.name}: ${g.missing}/${g.total} missing (${percentage}% coverage)`);
  });
  
  console.log('\nGroups with 100% coverage:');
  const perfectGroups = groupStats.filter(g => g.total > 0 && g.missing === 0);
  if (perfectGroups.length > 0) {
    perfectGroups.forEach(g => {
      console.log(`  ✓ ${g.name} (${g.total} tests)`);
    });
  } else {
    console.log('  None');
  }
  
  console.log('\nGroups with 0% coverage:');
  const zeroGroups = groupStats.filter(g => g.total > 0 && g.found === 0);
  if (zeroGroups.length > 0) {
    zeroGroups.forEach(g => {
      console.log(`  ✗ ${g.name} (${g.total} tests)`);
    });
  } else {
    console.log('  None');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('OVERALL STATISTICS:');
  console.log('='.repeat(80));
  console.log(`Total groups: ${result.tests.group.length}`);
  console.log(`Total tests: ${totalTests}`);
  console.log(`Tests found: ${totalFound} (${((totalFound/totalTests)*100).toFixed(1)}%)`);
  console.log(`Tests missing: ${totalMissing} (${((totalMissing/totalTests)*100).toFixed(1)}%)`);
  
  // Export missing tests to a file
  const outputFile = 'missing-xml-tests.txt';
  const output: string[] = [];
  output.push('MISSING TEST EXPRESSIONS FROM XML TEST SUITE');
  output.push('=' .repeat(80));
  output.push(`Generated: ${new Date().toISOString()}`);
  output.push(`Total missing: ${totalMissing} out of ${totalTests} tests`);
  output.push('');
  
  for (const group of groupStats) {
    if (group.missingExpressions.length > 0) {
      output.push(`\nGroup: ${group.name} (${group.missing} missing)`);
      output.push('-'.repeat(40));
      group.missingExpressions.forEach(expr => output.push(expr));
    }
  }
  
  fs.writeFileSync(outputFile, output.join('\n'));
  console.log(`\nDetailed missing tests written to: ${outputFile}`);
}

main().catch(console.error);