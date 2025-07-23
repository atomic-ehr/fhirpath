import { describe, it, expect, beforeEach, afterAll } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { Interpreter } from '../src/interpreter/interpreter';
import { Compiler } from '../src/compiler';
import { ContextManager } from '../src/interpreter/context';
import { parse } from '../src/parser';
import type { Context } from '../src/interpreter/types';

// Import the global registry to ensure all operations are registered
import '../src/registry';

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

// Load all test data from the test-data directory
function loadTestData(): TestSuite[] {
  const testDataDir = join(__dirname, 'test-data');
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
      } else if (entry.endsWith('.json')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }
  
  const jsonFiles = findJsonFiles(testDataDir);
  
  // Load each JSON file
  for (const file of jsonFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      const suite = JSON.parse(content) as TestSuite;
      testSuites.push(suite);
      console.log(`Loaded test suite: ${suite.name} (${suite.tests.length} tests)`);
    } catch (error) {
      console.error(`Failed to load ${file}:`, error);
    }
  }
  
  return testSuites;
}

const testSuites = loadTestData();

describe('Unified FHIRPath Tests', () => {
  let interpreter: Interpreter;
  let compiler: Compiler;
  let results: TestResult[] = [];

  beforeEach(() => {
    interpreter = new Interpreter();
    compiler = new Compiler();
  });

  function createContext(test: UnifiedTest): Context {
    let context = ContextManager.create(test.context?.rootContext);
    
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
          env: { ...context.env, ...test.context.env }
        };
      }
    }
    
    return context;
  }

  function runInterpreterTest(test: UnifiedTest, context: Context): TestResult['interpreterResult'] {
    const startTime = performance.now();
    
    try {
      const ast = parse(test.expression);
      const result = interpreter.evaluate(ast, test.input, context);
      const endTime = performance.now();
      
      return {
        success: true,
        value: result.value,
        time: endTime - startTime
      };
    } catch (error: any) {
      const endTime = performance.now();
      
      return {
        success: false,
        error: error.message,
        time: endTime - startTime
      };
    }
  }

  function runCompilerTest(test: UnifiedTest, context: Context): TestResult['compilerResult'] {
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
        env: runtimeEnv 
      });
      
      const endTime = performance.now();
      
      return {
        success: true,
        value: result,
        time: endTime - startTime
      };
    } catch (error: any) {
      const endTime = performance.now();
      
      return {
        success: false,
        error: error.message,
        time: endTime - startTime
      };
    }
  }

  function compareResults(test: UnifiedTest, interpreterResult?: any, compilerResult?: any): boolean {
    // Deep equality check
    return JSON.stringify(interpreterResult) === JSON.stringify(compilerResult);
  }

  // Run tests for each suite
  testSuites.forEach(suite => {
    describe(suite.name, () => {
      if (suite.description) {
        console.log(`\n${suite.description}\n`);
      }

      suite.tests.forEach(test => {
        it(test.name, () => {
          const context = createContext(test);
          let result: TestResult = {
            test,
            suite: suite.name,
            matched: false
          };

          // Run interpreter test if not skipped
          if (!test.skip?.interpreter) {
            result.interpreterResult = runInterpreterTest(test, context);
          }

          // Run compiler test if not skipped
          if (!test.skip?.compiler) {
            result.compilerResult = runCompilerTest(test, context);
          }

          // Compare results
          if (result.interpreterResult && result.compilerResult) {
            if (result.interpreterResult.success && result.compilerResult.success) {
              result.matched = compareResults(
                test,
                result.interpreterResult.value,
                result.compilerResult.value
              );
              
              // Both should match expected
              expect(result.interpreterResult.value).toEqual(test.expected);
              expect(result.compilerResult.value).toEqual(test.expected);
              expect(result.matched).toBe(true);
            } else if (!result.interpreterResult.success && !result.compilerResult.success) {
              // Both failed - this is ok if we expected an error
              if (test.expectedError) {
                expect(result.interpreterResult.error).toContain(test.expectedError);
                expect(result.compilerResult.error).toContain(test.expectedError);
              } else {
                // Unexpected failure
                throw new Error(
                  `Both implementations failed unexpectedly:\n` +
                  `Interpreter: ${result.interpreterResult.error}\n` +
                  `Compiler: ${result.compilerResult.error}`
                );
              }
            } else {
              // One succeeded, one failed - this is bad
              throw new Error(
                `Implementations differ:\n` +
                `Interpreter: ${result.interpreterResult.success ? 'SUCCESS' : result.interpreterResult.error}\n` +
                `Compiler: ${result.compilerResult.success ? 'SUCCESS' : result.compilerResult.error}`
              );
            }
          } else if (result.interpreterResult) {
            // Only interpreter test
            if (result.interpreterResult.success) {
              expect(result.interpreterResult.value).toEqual(test.expected);
            } else if (test.expectedError) {
              expect(result.interpreterResult.error).toContain(test.expectedError);
            } else {
              throw new Error(`Interpreter failed: ${result.interpreterResult.error}`);
            }
          } else if (result.compilerResult) {
            // Only compiler test
            if (result.compilerResult.success) {
              expect(result.compilerResult.value).toEqual(test.expected);
            } else if (test.expectedError) {
              expect(result.compilerResult.error).toContain(test.expectedError);
            } else {
              throw new Error(`Compiler failed: ${result.compilerResult.error}`);
            }
          }

          results.push(result);
        });
      });
    });
  });

  // Summary report
  afterAll(() => {
    console.log('\n=== Unified Test Summary ===\n');
    
    const totalTests = results.length;
    const bothRun = results.filter(r => r.interpreterResult && r.compilerResult).length;
    const matched = results.filter(r => r.matched).length;
    const interpreterOnly = results.filter(r => r.interpreterResult && !r.compilerResult).length;
    const compilerOnly = results.filter(r => r.compilerResult && !r.interpreterResult).length;
    
    console.log(`Total tests: ${totalTests}`);
    console.log(`Both implementations: ${bothRun} (${matched} matched)`);
    console.log(`Interpreter only: ${interpreterOnly}`);
    console.log(`Compiler only: ${compilerOnly}`);
    
    // Performance comparison
    const performanceData = results
      .filter(r => r.interpreterResult?.success && r.compilerResult?.success)
      .map(r => ({
        test: r.test.name,
        suite: r.suite,
        interpreterTime: r.interpreterResult!.time,
        compilerTime: r.compilerResult!.time,
        speedup: r.interpreterResult!.time / r.compilerResult!.time
      }));
    
    if (performanceData.length > 0) {
      const avgSpeedup = performanceData.reduce((sum, p) => sum + p.speedup, 0) / performanceData.length;
      const maxSpeedup = Math.max(...performanceData.map(p => p.speedup));
      const minSpeedup = Math.min(...performanceData.map(p => p.speedup));
      
      console.log('\n=== Performance Comparison ===\n');
      console.log(`Average speedup (Compiler vs Interpreter): ${avgSpeedup.toFixed(2)}x`);
      console.log(`Max speedup: ${maxSpeedup.toFixed(2)}x`);
      console.log(`Min speedup: ${minSpeedup.toFixed(2)}x`);
      
      // Show top 5 best speedups
      console.log('\nTop 5 speedups:');
      performanceData
        .sort((a, b) => b.speedup - a.speedup)
        .slice(0, 5)
        .forEach(p => {
          console.log(`  [${p.suite}] ${p.test}: ${p.speedup.toFixed(2)}x (${p.interpreterTime.toFixed(2)}ms → ${p.compilerTime.toFixed(2)}ms)`);
        });
    }
    
    // Show any mismatches
    const mismatches = results.filter(r => 
      r.interpreterResult?.success && 
      r.compilerResult?.success && 
      !r.matched
    );
    
    if (mismatches.length > 0) {
      console.log('\n=== MISMATCHES ===\n');
      mismatches.forEach(m => {
        console.log(`Suite: ${m.suite}`);
        console.log(`Test: ${m.test.name}`);
        console.log(`Expression: ${m.test.expression}`);
        console.log(`Interpreter: ${JSON.stringify(m.interpreterResult!.value)}`);
        console.log(`Compiler: ${JSON.stringify(m.compilerResult!.value)}`);
        console.log('---');
      });
    }

    // Show test distribution by suite
    console.log('\n=== Test Distribution ===\n');
    const testsBySuite = new Map<string, number>();
    results.forEach(r => {
      testsBySuite.set(r.suite, (testsBySuite.get(r.suite) || 0) + 1);
    });
    Array.from(testsBySuite.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([suite, count]) => {
        console.log(`${suite}: ${count} tests`);
      });
  });
});