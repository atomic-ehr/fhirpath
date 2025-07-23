#!/usr/bin/env bun

import {
  runTestFromFile,
  runAllTestsFromFile,
  debugExpression,
  loadTestSuite,
  findTest,
  findTestsByTag,
  runSingleTest
} from "./json-test-helpers";

// Example 1: Debug a specific test that's failing
console.log("=== Example 1: Debug a specific failing test ===");
runTestFromFile('test-data/operators/arithmetic.json', 'addition - integers');

// Example 2: Debug only with interpreter
console.log("\n=== Example 2: Run test with interpreter only ===");
runTestFromFile('test-data/operators/arithmetic.json', 'subtraction - decimals', 'interpreter');

// Example 3: Debug a custom expression
console.log("\n=== Example 3: Debug custom expression ===");
debugExpression('Patient.name.given.first()', [
  {
    resourceType: 'Patient',
    name: [
      {
        given: ['John', 'Jacob'],
        family: 'Doe'
      }
    ]
  }
]);

// Example 4: Find and run all tests with a specific tag
console.log("\n=== Example 4: Run all tests with 'decimal' tag ===");
const suite = loadTestSuite('test-data/operators/arithmetic.json');
const decimalTests = findTestsByTag(suite, 'decimal');
console.log(`Found ${decimalTests.length} tests with 'decimal' tag`);
decimalTests.forEach(test => runSingleTest(test, 'compiler'));

// Example 5: Debug expression with variables
console.log("\n=== Example 5: Debug expression with variables ===");
debugExpression('%foo + %bar', [], {
  variables: {
    foo: [10],
    bar: [20]
  }
});

// Example 6: Performance comparison
console.log("\n=== Example 6: Performance comparison ===");
const complexExpression = 'Patient.name.where(use = "official").given.first()';
const complexInput = [{
  resourceType: 'Patient',
  name: [
    { use: 'nickname', given: ['Johnny'] },
    { use: 'official', given: ['John', 'Jacob'] },
    { use: 'old', given: ['J.J.'] }
  ]
}];

debugExpression(complexExpression, complexInput);

// Example 7: Load and inspect test structure
console.log("\n=== Example 7: Inspect test structure ===");
const arithmeticSuite = loadTestSuite('test-data/operators/arithmetic.json');
console.log(`Suite: ${arithmeticSuite.name}`);
console.log(`Total tests: ${arithmeticSuite.tests.length}`);
console.log(`First test:`, arithmeticSuite.tests[0]);

// Example 8: Run multiple specific tests
console.log("\n=== Example 8: Run multiple specific tests ===");
const testsToRun = [
  'addition - integers',
  'multiplication - decimals',
  'division - by zero'
];

testsToRun.forEach(testName => {
  const test = findTest(arithmeticSuite, testName);
  if (test) {
    runSingleTest(test);
  } else {
    console.log(`⚠️  Test "${testName}" not found`);
  }
});