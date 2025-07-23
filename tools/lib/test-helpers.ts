import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { Interpreter } from "../../src/interpreter/interpreter";
import { Compiler } from "../../src/compiler";
import { ContextManager } from "../../src/interpreter/context";
import { parse } from "../../src/parser";
import type { Context } from "../../src/interpreter/types";

// Import the global registry to ensure all operations are registered
import "../../src/registry";

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

function createContext(test: UnifiedTest, input: any[]): Context {
  // Use rootContext if provided, otherwise use the test input as context
  const initialContext = test.context?.rootContext ?? input;
  let context = ContextManager.create(initialContext);

  if (test.context) {
    if (test.context.variables) {
      Object.entries(test.context.variables).forEach(([name, value]) => {
        context = ContextManager.setVariable(context, name, value);
      });
    }

    if (test.context.env) {
      context = {
        ...context,
        env: { ...context.env, ...test.context.env },
      };
    }
  }

  return context;
}

function matchesError(error: Error, expectedError: UnifiedTest['error']): boolean {
  if (!expectedError) return false;
  
  // Check error phase (we'll check this based on error type/message patterns)
  // Check error message matches regex
  const messageRegex = new RegExp(expectedError.message);
  return messageRegex.test(error.message);
}

export function runSingleTest(test: UnifiedTest, mode: 'interpreter' | 'compiler' | 'both' = 'both') {
  const interpreter = new Interpreter();
  const compiler = new Compiler();
  const context = createContext(test, test.input);

  console.log(`\n🧪 Running test: ${test.name}`);
  
  // Check if test is pending
  if (test.pending) {
    const reason = typeof test.pending === 'string' ? test.pending : 'Pending implementation';
    console.log(`   ⏸️  PENDING: ${reason}`);
    return {
      interpreter: { success: true, pending: true },
      compiler: { success: true, pending: true }
    };
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

  const results: any = {};

  // Run interpreter test
  if ((mode === 'interpreter' || mode === 'both') && !test.skip?.interpreter) {
    console.log(`\n📊 Interpreter:`);
    const startTime = performance.now();
    
    try {
      const ast = parse(test.expression);
      const result = interpreter.evaluate(ast, test.input, context);
      const endTime = performance.now();
      
      if (test.error) {
        // Expected an error but got a result
        results.interpreter = {
          success: false,
          value: result.value,
          time: endTime - startTime,
          error: "Expected error but got result"
        };
        
        console.log(`   ❌ Expected error but got: ${JSON.stringify(result.value)}`);
        console.log(`   ⏱️  Time: ${(endTime - startTime).toFixed(2)}ms`);
      } else {
        results.interpreter = {
          success: true,
          value: result.value,
          time: endTime - startTime
        };
        
        console.log(`   ✅ Result: ${JSON.stringify(result.value)}`);
        console.log(`   ⏱️  Time: ${(endTime - startTime).toFixed(2)}ms`);
        
        const matches = JSON.stringify(result.value) === JSON.stringify(test.expected);
        console.log(`   ${matches ? '✅' : '❌'} Matches expected: ${matches}`);
      }
    } catch (error: any) {
      const endTime = performance.now();
      
      if (test.error && matchesError(error, test.error)) {
        // Got expected error
        results.interpreter = {
          success: true,
          error: error.message,
          time: endTime - startTime,
          expectedError: true
        };
        
        console.log(`   ✅ Got expected error: ${error.message}`);
        console.log(`   ⏱️  Time: ${(endTime - startTime).toFixed(2)}ms`);
      } else {
        // Unexpected error
        results.interpreter = {
          success: false,
          error: error.message,
          time: endTime - startTime
        };
        
        console.log(`   ❌ Error: ${error.message}`);
        console.log(`   ⏱️  Time: ${(endTime - startTime).toFixed(2)}ms`);
        
        if (test.error) {
          console.log(`   ℹ️  Expected error: ${test.error.type} - /${test.error.message}/`);
        }
      }
    }
  }

  // Run compiler test
  if ((mode === 'compiler' || mode === 'both') && !test.skip?.compiler) {
    console.log(`\n🚀 Compiler:`);
    const startTime = performance.now();
    
    try {
      const ast = parse(test.expression);
      const compiled = compiler.compile(ast);
      
      // Convert Context to RuntimeContext
      const runtimeEnv: Record<string, any> = { ...context.env };
      
      // Copy variables from Context.variables to env
      context.variables.forEach((value, key) => {
        runtimeEnv[key] = value;
      });
      
      const runtimeContext = {
        data: test.input,
        env: runtimeEnv,
        rootData: context.rootContext
      };
      
      const result = compiled(runtimeContext);
      const endTime = performance.now();
      
      if (test.error) {
        // Expected an error but got a result
        results.compiler = {
          success: false,
          value: result,
          time: endTime - startTime,
          error: "Expected error but got result"
        };
        
        console.log(`   ❌ Expected error but got: ${JSON.stringify(result)}`);
        console.log(`   ⏱️  Time: ${(endTime - startTime).toFixed(2)}ms`);
      } else {
        results.compiler = {
          success: true,
          value: result,
          time: endTime - startTime
        };
        
        console.log(`   ✅ Result: ${JSON.stringify(result)}`);
        console.log(`   ⏱️  Time: ${(endTime - startTime).toFixed(2)}ms`);
        
        const matches = JSON.stringify(result) === JSON.stringify(test.expected);
        console.log(`   ${matches ? '✅' : '❌'} Matches expected: ${matches}`);
      }
    } catch (error: any) {
      const endTime = performance.now();
      
      if (test.error && matchesError(error, test.error)) {
        // Got expected error
        results.compiler = {
          success: true,
          error: error.message,
          time: endTime - startTime,
          expectedError: true
        };
        
        console.log(`   ✅ Got expected error: ${error.message}`);
        console.log(`   ⏱️  Time: ${(endTime - startTime).toFixed(2)}ms`);
      } else {
        // Unexpected error
        results.compiler = {
          success: false,
          error: error.message,
          time: endTime - startTime
        };
        
        console.log(`   ❌ Error: ${error.message}`);
        console.log(`   ⏱️  Time: ${(endTime - startTime).toFixed(2)}ms`);
        
        if (test.error) {
          console.log(`   ℹ️  Expected error: ${test.error.type} - /${test.error.message}/`);
        }
      }
    }
  }

  // Compare results
  if (mode === 'both' && results.interpreter && results.compiler) {
    console.log(`\n🔍 Comparison:`);
    
    if ((results.interpreter.success || results.interpreter.expectedError) && 
        (results.compiler.success || results.compiler.expectedError)) {
      if (results.interpreter.value !== undefined && results.compiler.value !== undefined) {
        const match = JSON.stringify(results.interpreter.value) === JSON.stringify(results.compiler.value);
        console.log(`   ${match ? '✅' : '❌'} Results match: ${match}`);
        
        if (!match) {
          console.log(`   Interpreter: ${JSON.stringify(results.interpreter.value)}`);
          console.log(`   Compiler: ${JSON.stringify(results.compiler.value)}`);
        }
      } else if (results.interpreter.expectedError && results.compiler.expectedError) {
        console.log(`   ✅ Both got expected errors`);
      }
      
      const speedup = results.interpreter.time / results.compiler.time;
      console.log(`   ⚡ Speedup: ${speedup.toFixed(2)}x`);
    } else {
      console.log(`   ⚠️  One or both implementations failed`);
    }
  }

  return results;
}

export function runTestFromFile(filePath: string, testName: string, mode: 'interpreter' | 'compiler' | 'both' = 'both') {
  const suite = loadTestSuite(filePath);
  const test = findTest(suite, testName);
  
  if (!test) {
    console.error(`❌ Test "${testName}" not found in ${filePath}`);
    return;
  }
  
  return runSingleTest(test, mode);
}

export function runAllTestsFromFile(filePath: string, mode: 'interpreter' | 'compiler' | 'both' = 'both') {
  const suite = loadTestSuite(filePath);
  
  console.log(`\n🗂️  Running all tests from: ${suite.name}`);
  if (suite.description) {
    console.log(`   ${suite.description}`);
  }
  console.log(`   Total tests: ${suite.tests.length}`);
  
  const results = suite.tests.map(test => ({
    test,
    result: runSingleTest(test, mode)
  }));
  
  // Summary
  console.log(`\n📈 Summary:`);
  const passed = results.filter(r => {
    // Pending tests count as passed
    if (r.result.interpreter?.pending || r.result.compiler?.pending) {
      return true;
    }
    
    if (mode === 'both') {
      return (r.result.interpreter?.success || r.result.interpreter?.expectedError) && 
             (r.result.compiler?.success || r.result.compiler?.expectedError);
    } else if (mode === 'interpreter') {
      return r.result.interpreter?.success || r.result.interpreter?.expectedError;
    } else {
      return r.result.compiler?.success || r.result.compiler?.expectedError;
    }
  }).length;
  
  const pending = results.filter(r => 
    r.result.interpreter?.pending || r.result.compiler?.pending
  ).length;
  
  console.log(`   ✅ Passed: ${passed - pending}/${results.length}`);
  console.log(`   ❌ Failed: ${results.length - passed}/${results.length}`);
  if (pending > 0) {
    console.log(`   ⏸️  Pending: ${pending}/${results.length}`);
  }
  
  return results;
}

export function debugExpression(expression: string, input: any[] = [], context?: any) {
  console.log(`\n🔍 Debugging expression: ${expression}`);
  console.log(`   Input: ${JSON.stringify(input)}`);
  
  const test: UnifiedTest = {
    name: "Debug expression",
    expression,
    input,
    expected: [],
    context
  };
  
  return runSingleTest(test, 'both');
}

// Example usage functions
export function exampleUsage() {
  console.log(`
📚 JSON Test Helper Examples:

1. Run a specific test from a file:
   runTestFromFile('../../test-cases/operators/arithmetic.json', 'addition - integers')

2. Run all tests from a file:
   runAllTestsFromFile('../../test-cases/operators/arithmetic.json')

3. Debug a custom expression:
   debugExpression('2 + 3', [])

4. Find and run tests by tag:
   const suite = loadTestSuite('../../test-cases/operators/arithmetic.json');
   const additionTests = findTestsByTag(suite, 'addition');
   additionTests.forEach(test => runSingleTest(test));
`);
}