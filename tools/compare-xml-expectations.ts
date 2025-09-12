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
  error?: any[];
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

interface JsonTest {
  name: string;
  expression: string;
  expected?: any;
  error?: any;
  fromXML?: string;
  pending?: string | boolean;
}

interface JsonTestSuite {
  tests: JsonTest[];
}

// Map to store our test expectations by expression
const ourTests = new Map<string, { expected: any; error: any; file: string; name: string }>();

// Get all test cases from our JSON test files
function loadOurTests() {
  const testCasesDir = path.join(process.cwd(), 'test-cases');
  
  function walkDir(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filepath = path.join(dir, file);
      const stat = fs.statSync(filepath);
      if (stat.isDirectory()) {
        walkDir(filepath);
      } else if (file.endsWith('.json') && !file.endsWith('metadata.json')) {
        try {
          const content = fs.readFileSync(filepath, 'utf-8');
          const data = JSON.parse(content) as JsonTestSuite;
          if (data.tests && Array.isArray(data.tests)) {
            for (const test of data.tests) {
              if (test.expression) {
                const expr = test.expression.trim();
                const normalizedExpr = normalizeExpression(expr);
                
                // Store both original and normalized versions
                const testInfo = {
                  expected: test.expected,
                  error: test.error,
                  file: path.relative(process.cwd(), filepath),
                  name: test.name
                };
                
                ourTests.set(expr, testInfo);
                ourTests.set(normalizedExpr, testInfo);
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
}

// Normalize expression for comparison
function normalizeExpression(expr: string): string {
  return expr
    .replace(/\s+/g, ' ')
    .replace(/\s*([(),])\s*/g, '$1')
    .replace(/\s*([+\-*\/=<>!&|])\s*/g, ' $1 ')
    .trim();
}

// Parse XML output value
function parseXmlOutput(output: any): any {
  if (!output || output.length === 0) return undefined;
  
  const firstOutput = output[0];
  
  // Handle different XML output formats
  if (firstOutput === undefined || firstOutput === null) {
    return [];
  }
  
  // Handle boolean/string literals
  if (firstOutput.$ && firstOutput.$.type) {
    const type = firstOutput.$.type;
    const value = firstOutput._ || firstOutput.$text || firstOutput.toString();
    
    switch(type) {
      case 'Boolean':
        return [value === 'true'];
      case 'Integer':
        return [parseInt(value)];
      case 'Decimal':
        return [parseFloat(value)];
      case 'String':
        return [value];
      default:
        return [value];
    }
  }
  
  // Handle collections
  if (firstOutput.collection) {
    const items = Array.isArray(firstOutput.collection) ? firstOutput.collection : [firstOutput.collection];
    return items.map((item: any) => {
      if (item.$ && item.$.type) {
        const type = item.$.type;
        const value = item._ || item.$text || item.toString();
        switch(type) {
          case 'Boolean':
            return value === 'true';
          case 'Integer':
            return parseInt(value);
          case 'Decimal':
            return parseFloat(value);
          case 'String':
            return value;
          default:
            return value;
        }
      }
      return item;
    });
  }
  
  // Simple value
  if (typeof firstOutput === 'string') {
    // Try to parse as boolean
    if (firstOutput === 'true' || firstOutput === 'false') {
      return [firstOutput === 'true'];
    }
    // Try to parse as number
    const num = parseFloat(firstOutput);
    if (!isNaN(num) && firstOutput.match(/^-?\d+(\.\d+)?$/)) {
      return [num];
    }
    return [firstOutput];
  }
  
  return [firstOutput];
}

// Ensure our expected values are always arrays
function ensureArray(value: any): any {
  if (value === undefined || value === null) return undefined;
  if (value && typeof value === 'object' && 'error' in value) return value;
  if (Array.isArray(value)) return value;
  return [value];
}

// Compare two values for equality (with type coercion for strings vs numbers/booleans)
function areEqual(val1: any, val2: any): boolean {
  if (val1 === val2) return true;
  if (val1 == null || val2 == null) return val1 == val2;
  
  // Array comparison
  if (Array.isArray(val1) && Array.isArray(val2)) {
    if (val1.length !== val2.length) return false;
    for (let i = 0; i < val1.length; i++) {
      if (!areEqual(val1[i], val2[i])) return false;
    }
    return true;
  }
  
  // Object comparison
  if (typeof val1 === 'object' && typeof val2 === 'object') {
    const keys1 = Object.keys(val1);
    const keys2 = Object.keys(val2);
    if (keys1.length !== keys2.length) return false;
    for (const key of keys1) {
      if (!areEqual(val1[key], val2[key])) return false;
    }
    return true;
  }
  
  // Type coercion for string vs number comparison
  if (typeof val1 === 'string' && typeof val2 === 'number') {
    const num = parseFloat(val1);
    if (!isNaN(num)) return num === val2;
  }
  if (typeof val1 === 'number' && typeof val2 === 'string') {
    const num = parseFloat(val2);
    if (!isNaN(num)) return val1 === num;
  }
  
  // Type coercion for string vs boolean comparison
  if (typeof val1 === 'string' && typeof val2 === 'boolean') {
    return (val1 === 'true' && val2 === true) || (val1 === 'false' && val2 === false);
  }
  if (typeof val1 === 'boolean' && typeof val2 === 'string') {
    return (val2 === 'true' && val1 === true) || (val2 === 'false' && val1 === false);
  }
  
  // Special handling for dates with @ prefix
  if (typeof val1 === 'string' && typeof val2 === 'string') {
    // Remove @ prefix if present and compare
    const v1 = val1.startsWith('@') ? val1.substring(1) : val1;
    const v2 = val2.startsWith('@') ? val2.substring(1) : val2;
    return v1 === v2;
  }
  
  return false;
}

async function main() {
  const xmlFile = path.join(process.cwd(), 'spec/fhirpathlab-tests/fhirpathlab-tests.xml');
  
  if (!fs.existsSync(xmlFile)) {
    console.error(`XML test file not found: ${xmlFile}`);
    process.exit(1);
  }
  
  // Load our tests
  loadOurTests();
  console.log(`Loaded ${ourTests.size / 2} test expressions from our test suite\n`);
  
  const xmlContent = fs.readFileSync(xmlFile, 'utf-8');
  const result = await parseXml(xmlContent) as XmlTestSuite;
  
  let totalCompared = 0;
  let totalMatching = 0;
  let totalDifferent = 0;
  let totalNotFound = 0;
  
  const differences: Array<{
    group: string;
    test: string;
    expression: string;
    xmlExpected: any;
    ourExpected: any;
    file: string;
  }> = [];
  
  console.log('='.repeat(80));
  console.log('COMPARING EXPECTED VALUES BETWEEN XML AND JSON TESTS');
  console.log('='.repeat(80));
  
  // Process ALL groups
  for (const group of result.tests.group) {
    const groupName = group.$.name;
    const tests = group.test || [];
    
    let groupDifferences = 0;
    
    for (const test of tests) {
      if (test.expression && test.expression.length > 0) {
        const exprRaw = test.expression[0];
        let expr: string;
        
        if (typeof exprRaw === 'string') {
          expr = exprRaw;
        } else if (exprRaw && typeof exprRaw === 'object' && exprRaw._) {
          expr = exprRaw._;
        } else if (exprRaw && typeof exprRaw === 'object' && '$value' in exprRaw) {
          expr = exprRaw.$value;
        } else {
          continue;
        }
        
        const normalizedExpr = normalizeExpression(expr);
        
        // Check if we have this test
        const ourTest = ourTests.get(expr) || ourTests.get(normalizedExpr);
        
        if (ourTest) {
          totalCompared++;
          
          // Check if XML test has no output and no error (undefined expectation)
          const hasXmlOutput = test.output && test.output.length > 0;
          const hasXmlError = test.error && test.error.length > 0;
          
          if (!hasXmlOutput && !hasXmlError) {
            // Flag tests with no expectation in XML
            totalDifferent++;
            groupDifferences++;
            differences.push({
              group: groupName,
              test: test.$.name,
              expression: expr,
              xmlExpected: { noExpectation: true },
              ourExpected: ourTest.error ? { error: true } : ensureArray(ourTest.expected),
              file: ourTest.file
            });
          } else {
            // Parse XML expected value
            const xmlExpected = test.error ? { error: true } : parseXmlOutput(test.output);
            const ourExpected = ourTest.error ? { error: true } : ensureArray(ourTest.expected);
            
            // Compare expectations
            if (!areEqual(xmlExpected, ourExpected)) {
              totalDifferent++;
              groupDifferences++;
              differences.push({
                group: groupName,
                test: test.$.name,
                expression: expr,
                xmlExpected,
                ourExpected,
                file: ourTest.file
              });
            } else {
              totalMatching++;
            }
          }
        } else {
          totalNotFound++;
        }
      }
    }
    
    if (groupDifferences > 0) {
      console.log(`\n⚠️  Group: ${groupName} (${groupDifferences} differences)`);
      console.log('-'.repeat(60));
      
      const groupDiffs = differences.filter(d => d.group === groupName);
      for (const diff of groupDiffs.slice(0, 5)) {
        console.log(`  Test: ${diff.test}`);
        console.log(`  Expression: ${diff.expression}`);
        if (diff.xmlExpected && diff.xmlExpected.noExpectation) {
          console.log(`  XML expects: ⚠️ NO EXPECTATION DEFINED IN XML`);
        } else {
          console.log(`  XML expects: ${JSON.stringify(diff.xmlExpected)}`);
        }
        console.log(`  We have:     ${JSON.stringify(diff.ourExpected)}`);
        console.log(`  File: ${diff.file}`);
        console.log();
      }
      
      if (groupDiffs.length > 5) {
        console.log(`  ... and ${groupDiffs.length - 5} more differences in this group`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total tests compared: ${totalCompared}`);
  console.log(`✅ Matching expectations: ${totalMatching} (${((totalMatching/totalCompared)*100).toFixed(1)}%)`);
  console.log(`❌ Different expectations: ${totalDifferent} (${((totalDifferent/totalCompared)*100).toFixed(1)}%)`);
  console.log(`⚪ Tests not found in our suite: ${totalNotFound}`);
  
  if (differences.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('ALL DIFFERENCES');
    console.log('='.repeat(80));
    
    // Group by file
    const byFile = new Map<string, typeof differences>();
    for (const diff of differences) {
      if (!byFile.has(diff.file)) {
        byFile.set(diff.file, []);
      }
      byFile.get(diff.file)!.push(diff);
    }
    
    // Sort files by number of differences
    const sortedFiles = Array.from(byFile.entries())
      .sort((a, b) => b[1].length - a[1].length);
    
    console.log('\nFiles with differences (sorted by count):');
    for (const [file, diffs] of sortedFiles) {
      console.log(`\n📁 ${file} (${diffs.length} differences)`);
      for (const diff of diffs.slice(0, 3)) {
        console.log(`  - ${diff.test}: ${diff.expression}`);
        if (diff.xmlExpected && diff.xmlExpected.noExpectation) {
          console.log(`    XML: ⚠️ NO EXPECTATION DEFINED`);
        } else {
          console.log(`    XML: ${JSON.stringify(diff.xmlExpected)}`);
        }
        console.log(`    Our: ${JSON.stringify(diff.ourExpected)}`);
      }
      if (diffs.length > 3) {
        console.log(`  ... and ${diffs.length - 3} more`);
      }
    }
    
    // Export detailed differences
    const outputFile = 'test-expectation-differences.json';
    fs.writeFileSync(outputFile, JSON.stringify(differences, null, 2));
    console.log(`\n📄 Detailed differences exported to: ${outputFile}`);
  } else {
    console.log('\n🎉 All test expectations match perfectly!');
  }
}

main().catch(console.error);