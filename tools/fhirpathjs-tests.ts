#!/usr/bin/env bun

import * as yaml from 'js-yaml';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { evaluate } from '../src/index';
import type { EvaluationResult, ModelProvider } from '../src/types';
import { FHIRModelProvider } from '../src/model-provider';
import _ from 'lodash';

interface TestCase {
  desc?: string;
  expression: string | string[];
  result?: any;
  error?: boolean;
  inputfile?: string;
  model?: string;
  context?: string;
  variables?: Record<string, any>;
  disableConsoleLog?: boolean;
  pending?: boolean | string;
  'group'?: string;
}

interface TestFile {
  tests: (TestCase | { [key: string]: TestCase[] })[];
  subject?: any; // The default resource/subject for all tests in this file
}

interface TestResult {
  expression: string;
  desc?: string;
  passed: boolean;
  expected: any;
  actual: any;
  error?: string;
  pending?: boolean | string;
}

// Cache for loaded resources and model providers
const resourceCache: Record<string, any> = {};
const modelProviders: Record<string, ModelProvider> = {};

// Create model providers for each FHIR version
async function getModelProvider(version: string): Promise<ModelProvider | undefined> {
  if (!modelProviders[version]) {
    let packages: Array<{ name: string; version: string }>;
    
    switch (version) {
      case 'r4':
        packages = [{ name: 'hl7.fhir.r4.core', version: '4.0.1' }];
        break;
      case 'r5':
        packages = [{ name: 'hl7.fhir.r5.core', version: '5.0.0' }];
        break;
      case 'stu3':
        packages = [{ name: 'hl7.fhir.stu3.core', version: '3.0.2' }];
        break;
      case 'dstu2':
        packages = [{ name: 'hl7.fhir.dstu2.core', version: '1.0.2' }];
        break;
      default:
        return undefined;
    }
    
    const provider = new FHIRModelProvider({
      packages,
      cacheDir: './.fhir-cache'
    });
    
    await provider.initialize();
    modelProviders[version] = provider;
  }
  
  return modelProviders[version];
}

function loadResource(filePath: string): any {
  if (!resourceCache[filePath]) {
    if (!existsSync(filePath)) {
      throw new Error(`Resource file doesn't exist: ${filePath}`);
    }
    resourceCache[filePath] = JSON.parse(readFileSync(filePath, 'utf8'));
  }
  // Clone to avoid tests affecting each other
  return _.cloneDeep(resourceCache[filePath]);
}

function normalizeResult(value: any): any {
  // Convert our result format to match fhirpath.js expected format
  if (value === null || value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return [value];
  }
  // Handle Date/DateTime objects
  return value.map(v => {
    if (v && typeof v === 'object' && v._type) {
      // Our DateTime format, convert to string for comparison
      if (v._type === 'DateTime' || v._type === 'Date' || v._type === 'Time') {
        return v.value || v.toString();
      }
    }
    return v;
  });
}

async function runTest(test: TestCase, testResource?: any): Promise<TestResult[]> {
  const expressions = Array.isArray(test.expression) ? test.expression : [test.expression];
  const results: TestResult[] = [];

  for (const expression of expressions) {
    const result: TestResult = {
      expression,
      desc: test.desc,
      passed: false,
      expected: test.result,
      actual: null,
      pending: test.pending
    };

    if (test.pending) {
      result.passed = false;
      results.push(result);
      continue;
    }

    try {
      // Load input file if specified
      if (test.inputfile && !testResource) {
        const model = test.model || 'r4';
        const resourcePath = join(__dirname, '../fhirpath.js/test/resources', model, test.inputfile);
        testResource = loadResource(resourcePath);
      }

      // Prepare variables
      const variables: Record<string, any> = { };
      if (testResource) {
        variables.resource = testResource;
      }
      
      // Set context if specified
      if (test.context && testResource) {
        const contextResult = await evaluate(test.context, { input: testResource });
        variables.context = contextResult[0];
      }
      
      // Add test variables
      if (test.variables) {
        Object.assign(variables, test.variables);
      }

      // Get model provider if specified
      const modelProvider = test.model ? await getModelProvider(test.model) : undefined;

      // Run the expression
      const evalResult = await evaluate(expression, { 
        input: testResource || [],
        variables,
        modelProvider
      });
      
      result.actual = normalizeResult(evalResult);

      // Check if error was expected
      if (test.error) {
        result.passed = false;
        result.error = 'Expected error but got result';
      } else if (test.result !== undefined) {
        // Compare results
        const expectedNormalized = normalizeResult(test.result);
        result.passed = _.isEqual(expectedNormalized, result.actual);
      } else {
        // No expected result specified, just check it doesn't error
        result.passed = true;
      }
    } catch (error: any) {
      if (test.error) {
        result.passed = true;
        result.actual = 'Error: ' + error.message;
      } else {
        result.passed = false;
        result.error = error.message;
        result.actual = 'Error: ' + error.message;
      }
    }

    results.push(result);
  }

  return results;
}

async function processTestGroup(tests: any[], resource?: any): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  for (const test of tests) {
    // Check if this is a group (has a key starting with 'group:')
    const groupKey = Object.keys(test).find(k => k.startsWith('group'));
    if (groupKey) {
      // Handle grouped tests
      const groupTests = test[groupKey];
      if (Array.isArray(groupTests)) {
        const groupResults = await processTestGroup(groupTests, resource);
        results.push(...groupResults);
      }
    } else if (test.expression) {
      // Regular test case with expression
      const testResults = await runTest(test as TestCase, resource);
      results.push(...testResults);
    }
  }
  
  return results;
}

async function runTestFile(filePath: string, options: { verbose?: boolean; filter?: string } = {}): Promise<void> {
  const fileName = basename(filePath);
  console.log(`\n📁 Running tests from: ${fileName}`);
  console.log('─'.repeat(60));

  try {
    const content = readFileSync(filePath, 'utf8');
    const testFile = yaml.load(content) as TestFile;
    
    // Load the default resource for this test file
    let defaultResource: any = testFile.subject;
    
    // If subject is a minimal reference (just resourceType and id), try to load the full resource
    if (defaultResource && defaultResource.resourceType && defaultResource.id && Object.keys(defaultResource).length <= 3) {
      // Convention: load from test/resources/{model}/{resourceType}-{id}.json
      // Default to r4 if no model specified
      const resourceType = defaultResource.resourceType.toLowerCase();
      const id = defaultResource.id;
      const model = 'r4'; // Default model, could be enhanced to detect from context
      
      const resourcePath = join(__dirname, `../fhirpath.js/test/resources/${model}/${resourceType}-${id}.json`);
      if (existsSync(resourcePath)) {
        defaultResource = loadResource(resourcePath);
      }
    }
    
    // Fallback: Check for file-specific resource with same name
    if (!defaultResource) {
      const defaultResourceFile = filePath.replace(/\.yaml$/, '.json');
      if (existsSync(defaultResourceFile)) {
        defaultResource = loadResource(defaultResourceFile);
      }
    }

    const results = await processTestGroup(testFile.tests, defaultResource);
    
    // Apply filter if specified
    const filteredResults = options.filter 
      ? results.filter(r => r.expression.includes(options.filter!) || (r.desc && r.desc.includes(options.filter!)))
      : results;

    // Summary
    const passed = filteredResults.filter(r => r.passed && !r.pending).length;
    const failed = filteredResults.filter(r => !r.passed && !r.pending).length;
    const pending = filteredResults.filter(r => r.pending).length;
    const total = filteredResults.length;

    console.log(`\n📊 Results: ${passed}/${total} passed, ${failed} failed, ${pending} pending`);

    // Show failures if verbose or if there are failures
    if ((options.verbose || failed > 0) && failed > 0) {
      console.log('\n❌ Failed tests:');
      filteredResults.filter(r => !r.passed && !r.pending).forEach(r => {
        console.log(`\n  Expression: ${r.expression}`);
        if (r.desc) console.log(`  Description: ${r.desc}`);
        console.log(`  Expected: ${JSON.stringify(r.expected)}`);
        console.log(`  Actual: ${JSON.stringify(r.actual)}`);
        if (r.error) console.log(`  Error: ${r.error}`);
      });
    }

    // Show pending if verbose
    if (options.verbose && pending > 0) {
      console.log('\n⏸️  Pending tests:');
      filteredResults.filter(r => r.pending).forEach(r => {
        console.log(`  - ${r.expression}${r.pending && typeof r.pending === 'string' ? ': ' + r.pending : ''}`);
      });
    }

    return;
  } catch (error: any) {
    console.error(`\n❌ Error loading test file: ${error.message}`);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage: bun tools/fhirpathjs-tests.ts [options] [test-file|pattern]');
    console.log('');
    console.log('Run fhirpath.js test cases against our interpreter');
    console.log('');
    console.log('Arguments:');
    console.log('  test-file    Specific test file to run (e.g., simple.yaml)');
    console.log('  pattern      Pattern to match test files (e.g., "5.*.yaml")');
    console.log('');
    console.log('Options:');
    console.log('  --list       List all available test files');
    console.log('  --verbose    Show detailed output including passed tests');
    console.log('  --filter     Filter tests by expression or description');
    console.log('  --summary    Show only summary (default for all tests)');
    console.log('');
    console.log('Examples:');
    console.log('  bun tools/fhirpathjs-tests.ts simple.yaml');
    console.log('  bun tools/fhirpathjs-tests.ts --list');
    console.log('  bun tools/fhirpathjs-tests.ts "5.*.yaml" --verbose');
    console.log('  bun tools/fhirpathjs-tests.ts simple.yaml --filter "name"');
    console.log('  bun tools/fhirpathjs-tests.ts  # Run all tests');
    return;
  }

  const testCasesDir = join(__dirname, '../fhirpath.js/test/cases');
  
  // Handle --list option
  if (args.includes('--list')) {
    const files = readdirSync(testCasesDir)
      .filter(f => f.endsWith('.yaml'))
      .sort();
    console.log('Available test files:');
    files.forEach(f => console.log(`  - ${f}`));
    return;
  }

  // Parse options
  const options = {
    verbose: args.includes('--verbose'),
    filter: args.includes('--filter') ? args[args.indexOf('--filter') + 1] : undefined,
    summary: args.includes('--summary')
  };

  // Get test file pattern
  const fileArg = args.find(a => !a.startsWith('--') && a !== options.filter);
  
  // Get files to run
  let files: string[] = [];
  if (!fileArg) {
    // Run all test files
    files = readdirSync(testCasesDir)
      .filter(f => f.endsWith('.yaml'))
      .map(f => join(testCasesDir, f))
      .sort();
  } else if (fileArg.includes('*')) {
    // Pattern matching
    const pattern = new RegExp(fileArg.replace(/\*/g, '.*').replace(/\?/g, '.'));
    files = readdirSync(testCasesDir)
      .filter(f => f.endsWith('.yaml') && pattern.test(f))
      .map(f => join(testCasesDir, f))
      .sort();
  } else {
    // Specific file
    const filePath = fileArg.endsWith('.yaml') ? fileArg : `${fileArg}.yaml`;
    const fullPath = join(testCasesDir, filePath);
    if (!existsSync(fullPath)) {
      console.error(`Test file not found: ${filePath}`);
      process.exit(1);
    }
    files = [fullPath];
  }

  if (files.length === 0) {
    console.error('No test files found matching the pattern');
    process.exit(1);
  }

  console.log(`🎯 Running ${files.length} test file(s)...`);
  
  // Run tests
  let totalPassed = 0;
  let totalFailed = 0;
  let totalPending = 0;

  for (const file of files) {
    await runTestFile(file, options);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});