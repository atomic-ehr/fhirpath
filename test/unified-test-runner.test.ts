import { describe, it, beforeEach } from "bun:test";
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
  error?: {
    type: string;
    message: string;
    phase: 'parse' | 'analyze' | 'evaluate';
  };
  pending?: boolean | string;
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

interface TestResult {
  test: UnifiedTest;
  suite: string;
  interpreterResult?: {
    success: boolean;
    value?: any[];
    error?: string;
    time: number;
  };
  compilerResult?: {
    success: boolean;
    value?: any[];
    error?: string;
    time: number;
  };
  matched: boolean;
}

// Load all test data from the test-cases directory
function loadTestData(): TestSuite[] {
  const testDataDir = join(__dirname, "../test-cases");
  const testSuites: TestSuite[] = [];

  // Recursively find all .json files
  function findJsonFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...findJsonFiles(fullPath));
      } else if (entry.endsWith(".json")) {
        files.push(fullPath);
      }
    }

    return files;
  }

  const jsonFiles = findJsonFiles(testDataDir);

  // Load each JSON file
  for (const file of jsonFiles) {
    try {
      const content = readFileSync(file, "utf-8");
      const data = JSON.parse(content);
      
      // Skip files that don't have a tests array (like metadata.json)
      if (data.tests && Array.isArray(data.tests)) {
        const suite = data as TestSuite;
        testSuites.push(suite);
      }
    } catch (error) {
      console.error(`Failed to load ${file}:`, error);
    }
  }

  return testSuites;
}

const testSuites = loadTestData();

describe("Unified FHIRPath Tests", () => {
  let interpreter: Interpreter;
  let compiler: Compiler;
  let results: TestResult[] = [];
  let failedCount = 0;
  let passedCount = 0;

  beforeEach(() => {
    interpreter = new Interpreter();
    compiler = new Compiler();
  });

  function createContext(test: UnifiedTest): Context {
    // Use rootContext if provided, otherwise use the test input as context
    const initialContext = test.context?.rootContext ?? test.input;
    let context = ContextManager.create(initialContext);

    if (test.context) {
      // Add variables
      if (test.context.variables) {
        Object.entries(test.context.variables).forEach(([name, value]) => {
          context = ContextManager.setVariable(context, name, value);
        });
      }

      // Add environment variables
      if (test.context.env) {
        context = {
          ...context,
          env: { ...context.env, ...test.context.env },
        };
      }
    }

    return context;
  }

  function runInterpreterTest(
    test: UnifiedTest,
    context: Context
  ): TestResult["interpreterResult"] {
    const startTime = performance.now();

    try {
      const ast = parse(test.expression);
      const result = interpreter.evaluate(ast, test.input, context);
      const endTime = performance.now();

      return {
        success: true,
        value: result.value,
        time: endTime - startTime,
      };
    } catch (error: any) {
      const endTime = performance.now();

      return {
        success: false,
        error: error.message,
        time: endTime - startTime,
      };
    }
  }

  function runCompilerTest(
    test: UnifiedTest,
    context: Context
  ): TestResult["compilerResult"] {
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
      
      // Copy special context variables
      if (context.$context !== undefined) {
        runtimeEnv.$context = context.$context;
      }
      if (context.$resource !== undefined) {
        runtimeEnv.$resource = context.$resource;
      }
      if (context.$rootResource !== undefined) {
        runtimeEnv.$rootResource = context.$rootResource;
      }

      const result = compiled.fn({
        input: test.input,
        focus: test.input,
        env: runtimeEnv
      });

      const endTime = performance.now();

      return {
        success: true,
        value: result,
        time: endTime - startTime,
      };
    } catch (error: any) {
      const endTime = performance.now();

      return {
        success: false,
        error: error.message,
        time: endTime - startTime,
      };
    }
  }

  function compareResults(
    interpreterResult?: any,
    compilerResult?: any
  ): boolean {
    // Deep equality check
    return JSON.stringify(interpreterResult) === JSON.stringify(compilerResult);
  }

  // Run all tests
  testSuites.forEach((suite) => {
    suite.tests.forEach((test) => {
      it(`${suite.name}: ${test.name}`, () => {
        // Skip pending tests
        if (test.pending) {
          return;
        }
        
        const context = createContext(test);
        let result: TestResult = {
          test,
          suite: suite.name,
          matched: false,
        };

        try {
          // Run interpreter test if not skipped
          if (!test.skip?.interpreter) {
            result.interpreterResult = runInterpreterTest(test, context);
          }

          // Run compiler test if not skipped
          if (!test.skip?.compiler) {
            result.compilerResult = runCompilerTest(test, context);
          }

          // Always push result AFTER running tests but BEFORE assertions
          results.push(result);

          let failed = false;
          let failureMessage = "";

          // Compare results
          if (result.interpreterResult && result.compilerResult) {
            if (
              result.interpreterResult.success &&
              result.compilerResult.success
            ) {
              result.matched = compareResults(
                result.interpreterResult.value,
                result.compilerResult.value
              );

              // Both should match expected
              if (JSON.stringify(result.interpreterResult.value) !== JSON.stringify(test.expected)) {
                failed = true;
                failureMessage = `Expected: ${JSON.stringify(test.expected)}, Got: ${JSON.stringify(result.interpreterResult.value)}`;
              } else if (!result.matched) {
                failed = true;
                failureMessage = `Interpreter and Compiler results don't match`;
              }
            } else if (
              !result.interpreterResult.success &&
              !result.compilerResult.success
            ) {
              // Both failed - this is ok if we expected an error
              if (!test.expectedError) {
                failed = true;
                failureMessage = `Both implementations failed unexpectedly:\nInterpreter: ${result.interpreterResult.error}\nCompiler: ${result.compilerResult.error}`;
              }
            } else {
              // One succeeded, one failed - this is bad
              failed = true;
              failureMessage = `Implementations differ:\nInterpreter: ${
                result.interpreterResult.success
                  ? "SUCCESS"
                  : result.interpreterResult.error
              }\nCompiler: ${
                result.compilerResult.success
                  ? "SUCCESS"
                  : result.compilerResult.error
              }`;
            }
          } else if (result.interpreterResult) {
            // Only interpreter test
            if (result.interpreterResult.success) {
              if (JSON.stringify(result.interpreterResult.value) !== JSON.stringify(test.expected)) {
                failed = true;
                failureMessage = `Expected: ${JSON.stringify(test.expected)}, Got: ${JSON.stringify(result.interpreterResult.value)}`;
              }
            } else if (!test.expectedError) {
              failed = true;
              failureMessage = `Interpreter failed: ${result.interpreterResult.error}`;
            }
          } else if (result.compilerResult) {
            // Only compiler test
            if (result.compilerResult.success) {
              if (JSON.stringify(result.compilerResult.value) !== JSON.stringify(test.expected)) {
                failed = true;
                failureMessage = `Expected: ${JSON.stringify(test.expected)}, Got: ${JSON.stringify(result.compilerResult.value)}`;
              }
            } else if (!test.expectedError) {
              failed = true;
              failureMessage = `Compiler failed: ${result.compilerResult.error}`;
            }
          }

          if (failed) {
            failedCount++;
            console.error(`\n❌ FAILED: ${suite.name} - ${test.name}`);
            console.error(`   Expression: ${test.expression}`);
            console.error(`   ${failureMessage}`);
            throw new Error(failureMessage);
          } else {
            passedCount++;
          }
        } catch (error) {
          // Test already logged the failure, just re-throw
          throw error;
        }
      });
    });
  });

  // Summary report
  // afterAll(() => {
  //   console.log('\n=== Unified Test Summary ===\n');
  //
  //   const totalTests = results.length;
  //   const bothRun = results.filter(r => r.interpreterResult && r.compilerResult).length;
  //   const matched = results.filter(r => r.matched).length;
  //   const interpreterOnly = results.filter(r => r.interpreterResult && !r.compilerResult).length;
  //   const compilerOnly = results.filter(r => r.compilerResult && !r.interpreterResult).length;
  //
  //   console.log(`Total tests: ${totalTests}`);
  //   console.log(`Both implementations: ${bothRun} (${matched} matched)`);
  //   console.log(`Interpreter only: ${interpreterOnly}`);
  //   console.log(`Compiler only: ${compilerOnly}`);
  //
  //   // Performance comparison
  //   const performanceData = results
  //     .filter(r => r.interpreterResult?.success && r.compilerResult?.success)
  //     .map(r => ({
  //       test: r.test.name,
  //       suite: r.suite,
  //       interpreterTime: r.interpreterResult!.time,
  //       compilerTime: r.compilerResult!.time,
  //       speedup: r.interpreterResult!.time / r.compilerResult!.time
  //     }));
  //
  //   if (performanceData.length > 0) {
  //     const avgSpeedup = performanceData.reduce((sum, p) => sum + p.speedup, 0) / performanceData.length;
  //     const maxSpeedup = Math.max(...performanceData.map(p => p.speedup));
  //     const minSpeedup = Math.min(...performanceData.map(p => p.speedup));
  //
  //     console.log('\n=== Performance Comparison ===\n');
  //     console.log(`Average speedup (Compiler vs Interpreter): ${avgSpeedup.toFixed(2)}x`);
  //     console.log(`Max speedup: ${maxSpeedup.toFixed(2)}x`);
  //     console.log(`Min speedup: ${minSpeedup.toFixed(2)}x`);
  //
  //     // Show top 5 best speedups
  //     console.log('\nTop 5 speedups:');
  //     performanceData
  //       .sort((a, b) => b.speedup - a.speedup)
  //       .slice(0, 5)
  //       .forEach(p => {
  //         console.log(`  [${p.suite}] ${p.test}: ${p.speedup.toFixed(2)}x (${p.interpreterTime.toFixed(2)}ms → ${p.compilerTime.toFixed(2)}ms)`);
  //       });
  //   }
  //
  //   // Show any mismatches
  //   const mismatches = results.filter(r =>
  //     r.interpreterResult?.success &&
  //     r.compilerResult?.success &&
  //     !r.matched
  //   );
  //
  //   if (mismatches.length > 0) {
  //     console.log('\n=== MISMATCHES ===\n');
  //     mismatches.forEach(m => {
  //       console.log(`Suite: ${m.suite}`);
  //       console.log(`Test: ${m.test.name}`);
  //       console.log(`Expression: ${m.test.expression}`);
  //       console.log(`Interpreter: ${JSON.stringify(m.interpreterResult!.value)}`);
  //       console.log(`Compiler: ${JSON.stringify(m.compilerResult!.value)}`);
  //       console.log('---');
  //     });
  //   }
  //
  //   // Show test distribution by suite
  //   console.log('\n=== Test Distribution ===\n');
  //   const testsBySuite = new Map<string, number>();
  //   results.forEach(r => {
  //     testsBySuite.set(r.suite, (testsBySuite.get(r.suite) || 0) + 1);
  //   });
  //   Array.from(testsBySuite.entries())
  //     .sort(([a], [b]) => a.localeCompare(b))
  //     .forEach(([suite, count]) => {
  //       console.log(`${suite}: ${count} tests`);
  //     });
  // });
});
