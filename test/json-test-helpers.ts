import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { Interpreter } from "../src/interpreter/interpreter";
import { Compiler } from "../src/compiler";
import { ContextManager } from "../src/interpreter/context";
import { parse } from "../src/parser";
import type { Context } from "../src/interpreter/types";

// Import the global registry to ensure all operations are registered
import "../src/registry";

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
  expectedError?: string;
  tags?: string[];
  skip?: {
    interpreter?: boolean;
    compiler?: boolean;
    reason?: string;
  };
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

function createContext(test: UnifiedTest): Context {
  let context = ContextManager.create(test.context?.rootContext);

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

export function runSingleTest(test: UnifiedTest, mode: 'interpreter' | 'compiler' | 'both' = 'both') {
  const interpreter = new Interpreter();
  const compiler = new Compiler();
  const context = createContext(test);

  console.log(`\n🧪 Running test: ${test.name}`);
  console.log(`   Expression: ${test.expression}`);
  console.log(`   Input: ${JSON.stringify(test.input)}`);
  console.log(`   Expected: ${JSON.stringify(test.expected)}`);
  
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
      
      results.interpreter = {
        success: true,
        value: result.value,
        time: endTime - startTime
      };
      
      console.log(`   ✅ Result: ${JSON.stringify(result.value)}`);
      console.log(`   ⏱️  Time: ${(endTime - startTime).toFixed(2)}ms`);
      
      const matches = JSON.stringify(result.value) === JSON.stringify(test.expected);
      console.log(`   ${matches ? '✅' : '❌'} Matches expected: ${matches}`);
    } catch (error: any) {
      const endTime = performance.now();
      results.interpreter = {
        success: false,
        error: error.message,
        time: endTime - startTime
      };
      
      console.log(`   ❌ Error: ${error.message}`);
      console.log(`   ⏱️  Time: ${(endTime - startTime).toFixed(2)}ms`);
      
      if (test.expectedError) {
        console.log(`   ℹ️  Expected error: ${test.expectedError}`);
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
      
      const result = compiled.fn({
        input: test.input,
        focus: test.input,
        env: {
          ...runtimeEnv,
          $this: test.input
        },
      });
      
      const endTime = performance.now();
      
      results.compiler = {
        success: true,
        value: result,
        time: endTime - startTime
      };
      
      console.log(`   ✅ Result: ${JSON.stringify(result)}`);
      console.log(`   ⏱️  Time: ${(endTime - startTime).toFixed(2)}ms`);
      
      const matches = JSON.stringify(result) === JSON.stringify(test.expected);
      console.log(`   ${matches ? '✅' : '❌'} Matches expected: ${matches}`);
    } catch (error: any) {
      const endTime = performance.now();
      results.compiler = {
        success: false,
        error: error.message,
        time: endTime - startTime
      };
      
      console.log(`   ❌ Error: ${error.message}`);
      console.log(`   ⏱️  Time: ${(endTime - startTime).toFixed(2)}ms`);
      
      if (test.expectedError) {
        console.log(`   ℹ️  Expected error: ${test.expectedError}`);
      }
    }
  }

  // Compare results
  if (mode === 'both' && results.interpreter && results.compiler) {
    console.log(`\n🔍 Comparison:`);
    
    if (results.interpreter.success && results.compiler.success) {
      const match = JSON.stringify(results.interpreter.value) === JSON.stringify(results.compiler.value);
      console.log(`   ${match ? '✅' : '❌'} Results match: ${match}`);
      
      if (!match) {
        console.log(`   Interpreter: ${JSON.stringify(results.interpreter.value)}`);
        console.log(`   Compiler: ${JSON.stringify(results.compiler.value)}`);
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
    if (mode === 'both') {
      return r.result.interpreter?.success && r.result.compiler?.success;
    } else if (mode === 'interpreter') {
      return r.result.interpreter?.success;
    } else {
      return r.result.compiler?.success;
    }
  }).length;
  
  console.log(`   ✅ Passed: ${passed}/${results.length}`);
  console.log(`   ❌ Failed: ${results.length - passed}/${results.length}`);
  
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
   runTestFromFile('test-data/operators/arithmetic.json', 'addition - integers')

2. Run all tests from a file:
   runAllTestsFromFile('test-data/operators/arithmetic.json')

3. Debug a custom expression:
   debugExpression('2 + 3', [])

4. Find and run tests by tag:
   const suite = loadTestSuite('test-data/operators/arithmetic.json');
   const additionTests = findTestsByTag(suite, 'addition');
   additionTests.forEach(test => runSingleTest(test));

5. Run only interpreter or compiler:
   runTestFromFile('test-data/operators/arithmetic.json', 'addition - integers', 'interpreter')
   runTestFromFile('test-data/operators/arithmetic.json', 'addition - integers', 'compiler')
`);
}

export function runAllFailingTests(mode: 'interpreter' | 'compiler' | 'both' = 'both') {
  const testDataDir = join(__dirname, 'test-data');
  const allSuites: TestSuite[] = [];
  
  function findJsonFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...findJsonFiles(fullPath));
      } else if (entry.endsWith('.json')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }
  
  const jsonFiles = findJsonFiles(testDataDir);
  const failures: Array<{suite: string, test: UnifiedTest, error: any}> = [];
  
  // Load and run all tests
  for (const file of jsonFiles) {
    try {
      const content = readFileSync(file, "utf-8");
      const suite = JSON.parse(content) as TestSuite;
      
      for (const test of suite.tests) {
        try {
          const result = runSingleTest(test, mode);
          
          // Check if test failed
          let failed = false;
          if (mode === 'both') {
            failed = !result.interpreter?.success || !result.compiler?.success;
          } else if (mode === 'interpreter') {
            failed = !result.interpreter?.success;
          } else {
            failed = !result.compiler?.success;
          }
          
          if (failed) {
            failures.push({ suite: suite.name, test, error: result });
          }
        } catch (e) {
          failures.push({ suite: suite.name, test, error: e });
        }
      }
    } catch (error) {
      console.error(`Failed to load ${file}:`, error);
    }
  }
  
  // Summary
  console.log(`\n📊 Failing Tests Summary:`);
  console.log(`   Total failures: ${failures.length}`);
  
  // Group by suite
  const bySuite = new Map<string, typeof failures>();
  failures.forEach(f => {
    if (!bySuite.has(f.suite)) {
      bySuite.set(f.suite, []);
    }
    bySuite.get(f.suite)!.push(f);
  });
  
  console.log(`\n🗂️  Failures by suite:`);
  Array.from(bySuite.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([suite, fails]) => {
      console.log(`   ${suite}: ${fails.length} failures`);
    });
  
  return failures;
}