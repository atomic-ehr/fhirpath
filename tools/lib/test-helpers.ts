import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { evaluate } from "../../src/index";
import type { EvaluateOptions } from "../../src/index";

interface UnifiedTest {
  name: string;
  expression: string;
  input: any[];
  context?: {
    variables?: Record<string, any[]>;
    env?: Record<string, any>;
    rootContext?: any[];
  };
  expected: any[];
  expectedError?: string;  // deprecated
  error?: {               // new structured error format
    type: string;
    message: string;       // regex pattern
    phase: 'parse' | 'analyze' | 'evaluate';
  };
  pending?: boolean | string;  // mark test as pending with optional reason
  tags?: string[];
  skip?: {
    interpreter?: boolean;
    compiler?: boolean;
    reason?: string;
  };
  specRef?: string;
  parserOnly?: boolean;  // Flag to indicate this test should only test parser behavior
  mode?: string; // Parser mode: 'fast', 'standard', 'diagnostic'
}

interface TestSuite {
  name: string;
  description?: string;
  beforeEach?: {
    context?: any;
  };
  tests: UnifiedTest[];
}

export function loadTestSuite(filePath: string): TestSuite {
  const absolutePath = filePath.startsWith('/') ? filePath : join(__dirname, filePath);
  const content = readFileSync(absolutePath, "utf-8");
  return JSON.parse(content) as TestSuite;
}

export function findTest(suite: TestSuite, testName: string): UnifiedTest | undefined {
  return suite.tests.find(test => test.name === testName);
}

export function findTestByExpression(suite: TestSuite, expression: string): UnifiedTest | undefined {
  return suite.tests.find(test => test.expression === expression);
}

export function findTestsByTag(suite: TestSuite, tag: string): UnifiedTest[] {
  return suite.tests.filter(test => test.tags?.includes(tag) ?? false);
}

function createOptions(test: UnifiedTest): EvaluateOptions {
  const options: EvaluateOptions = {
    input: test.input
  };

  if (test.context?.variables) {
    options.variables = test.context.variables;
  }

  return options;
}

function matchesError(error: Error, expectedError: UnifiedTest['error']): boolean {
  if (!expectedError) return false;
  
  // Check error phase (we'll check this based on error type/message patterns)
  // Check error message matches regex
  const messageRegex = new RegExp(expectedError.message);
  return messageRegex.test(error.message);
}

export function runSingleTest(test: UnifiedTest) {
  const options = createOptions(test);

  console.log(`\n🧪 Running test: ${test.name}`);
  
  // Check if test is pending
  if (test.pending) {
    const reason = typeof test.pending === 'string' ? test.pending : 'Pending implementation';
    console.log(`   ⏸️  PENDING: ${reason}`);
    return { success: true, pending: true };
  }
  
  // Check if this is a parser-only test
  if (test.parserOnly) {
    console.log(`   ⚠️  PARSER-ONLY TEST: This test is designed to test parser behavior only`);
    console.log(`   Expression: ${test.expression}`);
    console.log(`   Parser Mode: ${test.mode || 'standard'}`);
    console.log(`   This test should be run through the main test suite, not the testcase tool`);
    return { success: true, skipped: true, reason: 'Parser-only test' };
  }
  
  console.log(`   Expression: ${test.expression}`);
  console.log(`   Input: ${JSON.stringify(test.input)}`);
  
  // Show expected result or error
  if (test.error) {
    console.log(`   Expected Error: ${test.error.type} - /${test.error.message}/ (${test.error.phase})`);
  } else {
    console.log(`   Expected: ${JSON.stringify(test.expected)}`);
  }
  
  if (test.context) {
    console.log(`   Context:`, test.context);
  }

  // Run test
  if (!test.skip?.interpreter) {
    console.log(`\n📊 Result:`);
    const startTime = performance.now();
    
    try {
      const result = evaluate(test.expression, options);
      const endTime = performance.now();
      
      if (test.error) {
        // Expected an error but got a result
        console.log(`   ❌ Expected error but got: ${JSON.stringify(result)}`);
        console.log(`   ⏱️  Time: ${(endTime - startTime).toFixed(2)}ms`);
        
        return {
          success: false,
          value: result,
          time: endTime - startTime,
          error: "Expected error but got result"
        };
      } else {
        const matches = JSON.stringify(result) === JSON.stringify(test.expected);
        
        console.log(`   ✅ Result: ${JSON.stringify(result)}`);
        console.log(`   ⏱️  Time: ${(endTime - startTime).toFixed(2)}ms`);
        console.log(`   ${matches ? '✅' : '❌'} Matches expected: ${matches}`);
        
        return {
          success: matches,
          value: result,
          time: endTime - startTime
        };
      }
    } catch (error: any) {
      const endTime = performance.now();
      
      if (test.error && matchesError(error, test.error)) {
        // Got expected error
        console.log(`   ✅ Got expected error: ${error.message}`);
        console.log(`   ⏱️  Time: ${(endTime - startTime).toFixed(2)}ms`);
        
        return {
          success: true,
          error: error.message,
          time: endTime - startTime,
          expectedError: true
        };
      } else {
        // Unexpected error
        console.log(`   ❌ Error: ${error.message}`);
        console.log(`   ⏱️  Time: ${(endTime - startTime).toFixed(2)}ms`);
        
        if (test.error) {
          console.log(`   ℹ️  Expected error: ${test.error.type} - /${test.error.message}/`);
        }
        
        return {
          success: false,
          error: error.message,
          time: endTime - startTime
        };
      }
    }
  }

  return { success: true, skipped: true, reason: 'Test skipped' };
}

export function runTestFromFile(filePath: string, testName: string) {
  const suite = loadTestSuite(filePath);
  const test = findTest(suite, testName);
  
  if (!test) {
    console.error(`❌ Test "${testName}" not found in ${filePath}`);
    return;
  }
  
  return runSingleTest(test);
}

export function runAllTestsFromFile(filePath: string) {
  const suite = loadTestSuite(filePath);
  
  console.log(`\n🗂️  Running all tests from: ${suite.name}`);
  if (suite.description) {
    console.log(`   ${suite.description}`);
  }
  
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let pending = 0;
  
  const startTime = performance.now();
  
  suite.tests.forEach((test) => {
    const result = runSingleTest(test);
    
    if (result.pending) {
      pending++;
    } else if (result.skipped) {
      skipped++;
    } else if (result.success) {
      passed++;
    } else {
      failed++;
    }
  });
  
  const endTime = performance.now();
  const totalTime = endTime - startTime;
  
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⏸️  Pending: ${pending}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ⏱️  Total Time: ${totalTime.toFixed(2)}ms`);
  console.log(`   ⚡ Average: ${(totalTime / suite.tests.length).toFixed(2)}ms/test`);
  
  return { passed, failed, skipped, pending };
}