#!/usr/bin/env bun

import {
  runTestFromFile,
  runAllTestsFromFile,
  debugExpression,
  loadTestSuite,
  findTest,
  findTestsByTag,
  runSingleTest,
  exampleUsage
} from "./json-test-helpers";

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
🧪 FHIRPath JSON Test Debugger

Usage:
  bun test/debug-json-tests.ts [command] [options]

Commands:
  run <file> <test-name> [mode]     Run a specific test from a JSON file
  all <file> [mode]                  Run all tests from a JSON file
  expr <expression> [input]          Debug a custom expression
  tag <file> <tag> [mode]            Run all tests with a specific tag
  find <file> <test-name>            Find and display a test without running
  examples                           Show usage examples

Options:
  mode: 'interpreter' | 'compiler' | 'both' (default: 'both')

Examples:
  bun test/debug-json-tests.ts run test-data/operators/arithmetic.json "addition - integers"
  bun test/debug-json-tests.ts all test-data/operators/arithmetic.json compiler
  bun test/debug-json-tests.ts expr "2 + 3"
  bun test/debug-json-tests.ts tag test-data/operators/arithmetic.json addition
`);
  process.exit(0);
}

const command = args[0];

switch (command) {
  case 'run': {
    const [_, file, testName, mode] = args;
    if (!file || !testName) {
      console.error('❌ Please provide both file path and test name');
      process.exit(1);
    }
    runTestFromFile(file, testName, mode as any);
    break;
  }
  
  case 'all': {
    const [_, file, mode] = args;
    if (!file) {
      console.error('❌ Please provide file path');
      process.exit(1);
    }
    runAllTestsFromFile(file, mode as any);
    break;
  }
  
  case 'expr': {
    const [_, expression, inputStr] = args;
    if (!expression) {
      console.error('❌ Please provide expression');
      process.exit(1);
    }
    const input = inputStr ? JSON.parse(inputStr) : [];
    debugExpression(expression, input);
    break;
  }
  
  case 'tag': {
    const [_, file, tag, mode] = args;
    if (!file || !tag) {
      console.error('❌ Please provide both file path and tag');
      process.exit(1);
    }
    
    const suite = loadTestSuite(file);
    const tests = findTestsByTag(suite, tag);
    
    console.log(`\n🏷️  Found ${tests.length} tests with tag "${tag}" in ${suite.name}`);
    
    tests.forEach(test => {
      runSingleTest(test, mode as any);
    });
    break;
  }
  
  case 'find': {
    const [_, file, testName] = args;
    if (!file || !testName) {
      console.error('❌ Please provide both file path and test name');
      process.exit(1);
    }
    
    const suite = loadTestSuite(file);
    const test = findTest(suite, testName);
    
    if (!test) {
      console.error(`❌ Test "${testName}" not found in ${file}`);
      process.exit(1);
    }
    
    console.log(`\n📋 Test Details:`);
    console.log(JSON.stringify(test, null, 2));
    break;
  }
  
  case 'examples': {
    exampleUsage();
    break;
  }
  
  default: {
    console.error(`❌ Unknown command: ${command}`);
    console.log('Run with --help for usage information');
    process.exit(1);
  }
}