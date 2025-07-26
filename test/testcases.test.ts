import { describe, it, beforeEach } from "bun:test";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { Interpreter } from "../src/interpreter/interpreter";
import { Compiler } from "../src/compiler";
import { RuntimeContextManager } from "../src/runtime/context";
import { parse as legacyParse } from "../src/parser/parser";
import { parse, parseForEvaluation, isStandardResult, isDiagnosticResult, type ParseResult } from "../src/api";
import type { RuntimeContext } from "../src/runtime/context";

// Import the global registry to ensure all operations are registered
import "../src/registry";

interface UnifiedTest {
  name: string;
  expression: string;
  input?: any[];
  mode?: string; // Parser mode: 'fast', 'standard', 'diagnostic', 'validate'
  options?: {
    maxErrors?: number;
    trackTrivia?: boolean;
  };
  context?: {
    variables?: Record<string, any[]>;
    env?: Record<string, any>;
    rootContext?: any[];
  };
  expected?: any[] | {
    error?: boolean;
    throws?: boolean;
    errorType?: string;
    valid?: boolean;
    hasAst?: boolean;
    diagnostics?: any[];
    hasErrors?: boolean;
    hasPartialAst?: boolean;
    astContains?: string[];
    hasRanges?: boolean;
    hasTrivia?: boolean;
    triviaContains?: string[];
    messageContains?: string[]; // Check if diagnostic message contains these strings
    performanceBaseline?: boolean;
    astConsistency?: boolean;
    noErrors?: boolean;
    minDiagnostics?: number;
    diagnosticCount?: number;
    earlyExit?: boolean;
    hasErrorNode?: boolean;
    backwardCompatible?: boolean;
  };
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
  testAllModes?: boolean;
  parserOnly?: boolean; // Flag to indicate this test should only test parser behavior
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

  function createContext(test: UnifiedTest): RuntimeContext {
    // Use rootContext if provided, otherwise use the test input as context
    const initialContext = test.context?.rootContext ?? test.input ?? [];
    let context = RuntimeContextManager.create(initialContext);

    if (test.context) {
      // Add variables
      if (test.context.variables) {
        Object.entries(test.context.variables).forEach(([name, value]) => {
          context = RuntimeContextManager.setVariable(context, name, value);
        });
      }

      // Add environment variables
      if (test.context.env) {
        Object.entries(test.context.env).forEach(([name, value]) => {
          if (name.startsWith('$')) {
            // Special environment variables
            const varName = name.substring(1); // Remove $ prefix
            context = RuntimeContextManager.setSpecialVariable(context, varName, value);
          } else {
            // User-defined variables go in context.variables
            context = RuntimeContextManager.setVariable(context, name, Array.isArray(value) ? value : [value]);
          }
        });
      }
    }

    return context;
  }

  function runInterpreterTest(
    test: UnifiedTest,
    context: RuntimeContext
  ): TestResult["interpreterResult"] {
    const startTime = performance.now();

    try {
      const ast = legacyParse(test.expression);
      // Convert input to array format if needed
      const inputArray = test.input === undefined ? [] : 
                        Array.isArray(test.input) ? test.input : [test.input];
      const result = interpreter.evaluate(ast, inputArray, context);
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
    context: any
  ): TestResult["compilerResult"] {
    const startTime = performance.now();

    try {
      const ast = legacyParse(test.expression);
      const compiled = compiler.compile(ast);

      // Convert input to array format if needed
      const inputArray = test.input === undefined ? [] : 
                        Array.isArray(test.input) ? test.input : [test.input];
      // Update context with the input array
      const ctxWithInput = RuntimeContextManager.withInput(context, inputArray);
      // Pass the updated context to compiled function
      const result = compiled.fn(ctxWithInput);

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

  function runParserModeTest(test: UnifiedTest): { success: boolean; error?: string } {
    try {
      // Map test modes to parser options
      const throwOnError = test.mode === 'fast';
      const errorRecovery = test.mode === 'diagnostic';
      const trackRanges = test.mode === 'diagnostic';
      
      // If testing all modes
      if (test.testAllModes) {
        // Test that all modes can parse without throwing
        try {
          parse(test.expression, { throwOnError: true });
          parse(test.expression);
          parse(test.expression, { errorRecovery: true, trackRanges: true });
          return { success: true };
        } catch (e) {
          return { success: false, error: 'Not all modes parsed successfully' };
        }
      }
      
      // Handle expected throws (for Fast mode error tests)
      if (typeof test.expected === 'object' && !Array.isArray(test.expected) && test.expected.throws) {
        try {
          const result = parse(test.expression, { throwOnError, errorRecovery, trackRanges, ...test.options });
          return { success: false, error: 'Expected parse to throw but it succeeded' };
        } catch (e: any) {
          // Check errorType if specified
          if (test.expected.errorType === 'ParseError' && e.name === 'ParseError') {
            return { success: true };
          }
          return { success: true };
        }
      }
      
      // Parse with options
      const result = parse(test.expression, { throwOnError, errorRecovery, trackRanges, ...test.options });
      
      // Check expectations
      if (typeof test.expected === 'object' && !Array.isArray(test.expected)) {
        const exp = test.expected;
        
        // Check if it's a standard result (Standard or Diagnostic modes)
        if (isStandardResult(result)) {
          // Check error flag
          if (exp.error !== undefined && result.hasErrors !== exp.error) {
            return { success: false, error: `Expected hasErrors=${exp.error}, got ${result.hasErrors}` };
          }
          
          // Check diagnostics
          if (exp.diagnostics) {
            if (result.diagnostics.length === 0 && exp.error) {
              return { success: false, error: `Expected diagnostics but got none` };
            }
            
            // Check specific diagnostic properties
            for (const expectedDiag of exp.diagnostics) {
              const hasMatchingDiag = result.diagnostics.some(d => {
                // Check code if specified
                if (expectedDiag.code && d.code !== expectedDiag.code) {
                  return false;
                }
                // Check severity if specified (note: 'error' maps to severity 1)
                if (expectedDiag.severity === 'error' && d.severity !== 1) {
                  return false;
                }
                // Check message if specified (partial match)
                if (expectedDiag.message && !d.message.includes(expectedDiag.message)) {
                  return false;
                }
                // Check messageContains if specified
                if (expectedDiag.messageContains) {
                  for (const substr of expectedDiag.messageContains) {
                    if (!d.message.includes(substr)) {
                      return false;
                    }
                  }
                }
                return true;
              });
              
              if (!hasMatchingDiag) {
                return { success: false, error: `Expected diagnostic with code=${expectedDiag.code} not found` };
              }
            }
          }
          
          // Check diagnostic count
          if (exp.diagnosticCount !== undefined && result.diagnostics.length !== exp.diagnosticCount) {
            return { success: false, error: `Expected ${exp.diagnosticCount} diagnostics, got ${result.diagnostics.length}` };
          }
          
          if (exp.minDiagnostics !== undefined && result.diagnostics.length < exp.minDiagnostics) {
            return { success: false, error: `Expected at least ${exp.minDiagnostics} diagnostics, got ${result.diagnostics.length}` };
          }
          
          // Check AST presence - only check if explicitly set
          if (exp.hasAst !== undefined) {
            const hasAst = 'ast' in result && result.ast !== undefined;
            if (hasAst !== exp.hasAst) {
              return { success: false, error: `Expected hasAst=${exp.hasAst}, got ${hasAst}` };
            }
          }
          
          // Check ranges presence (only for Diagnostic mode)
          if (exp.hasRanges !== undefined) {
            const hasRanges = isDiagnosticResult(result) && result.ranges !== undefined;
            if (hasRanges !== exp.hasRanges) {
              return { success: false, error: `Expected hasRanges=${exp.hasRanges}, got ${hasRanges}` };
            }
          }
          
          // Check partial AST (for Diagnostic mode)
          if (exp.hasPartialAst !== undefined && isDiagnosticResult(result)) {
            const hasPartialAst = result.isPartial === true;
            if (hasPartialAst !== exp.hasPartialAst) {
              return { success: false, error: `Expected hasPartialAst=${exp.hasPartialAst}, got ${hasPartialAst}` };
            }
          }
          
          // Check if AST contains specific nodes
          if (exp.astContains && result.ast) {
            for (const expected of exp.astContains) {
              const astString = JSON.stringify(result.ast);
              if (!astString.includes(expected)) {
                return { success: false, error: `Expected AST to contain '${expected}'` };
              }
            }
          }
          
          // Check error node presence
          if (exp.hasErrorNode !== undefined && result.ast) {
            const astString = JSON.stringify(result.ast);
            const hasErrorNode = astString.includes('"type":"Error"');
            if (hasErrorNode !== exp.hasErrorNode) {
              return { success: false, error: `Expected hasErrorNode=${exp.hasErrorNode}, got ${hasErrorNode}` };
            }
          }
        }
        
        // For validate mode tests
        if (exp.valid !== undefined) {
          // Currently validate mode returns standard result
          if (isStandardResult(result)) {
            const isValid = !result.hasErrors;
            if (isValid !== exp.valid) {
              return { success: false, error: `Expected valid=${exp.valid}, got ${isValid}` };
            }
          }
        }
        
        // Flexible checks that work across all modes
        // Allow tests to specify simple success criteria
        if (exp.error === false && isStandardResult(result) && result.hasErrors) {
          return { success: false, error: `Expected no errors but got ${result.diagnostics.length} diagnostics` };
        }
      }
      
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
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
          // Handle parser mode tests and parser error tests differently
          if (test.parserOnly || test.mode || (typeof test.expected === 'object' && !Array.isArray(test.expected) && 
              ('error' in test.expected || 'throws' in test.expected || 'valid' in test.expected || 
               'hasAst' in test.expected || 'diagnostics' in test.expected || 'hasPartialAst' in test.expected ||
               'hasRanges' in test.expected || 'astContains' in test.expected || 'hasErrorNode' in test.expected))) {
            // This is a parser mode test or parser error test
            const modeResult = runParserModeTest(test);
            
            // Skip interpreter/compiler tests for parser mode tests
            results.push(result);
            
            if (!modeResult.success) {
              failedCount++;
              throw new Error(modeResult.error || 'Parser mode test failed');
            } else {
              passedCount++;
            }
            return;
          }
          
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

              // Check if we expected an error but got success
              if (test.error) {
                failed = true;
                failureMessage = `Expected error matching /${test.error.message}/ but both implementations succeeded`;
              } else {
                // Both should match expected (if expected is an array)
                if (Array.isArray(test.expected) && JSON.stringify(result.interpreterResult.value) !== JSON.stringify(test.expected)) {
                  failed = true;
                  failureMessage = `Expected: ${JSON.stringify(test.expected)}, Got: ${JSON.stringify(result.interpreterResult.value)}`;
                } else if (!result.matched) {
                  failed = true;
                  failureMessage = `Interpreter and Compiler results don't match`;
                }
              }
            } else if (
              !result.interpreterResult.success &&
              !result.compilerResult.success
            ) {
              // Both failed - this is ok if we expected an error
              if (!test.expectedError && !test.error) {
                failed = true;
                failureMessage = `Both implementations failed unexpectedly:\nInterpreter: ${result.interpreterResult.error}\nCompiler: ${result.compilerResult.error}`;
              } else if (test.error) {
                // Check if error matches expected pattern
                const interpreterMatches = new RegExp(test.error.message).test(result.interpreterResult.error || '');
                const compilerMatches = new RegExp(test.error.message).test(result.compilerResult.error || '');
                if (!interpreterMatches || !compilerMatches) {
                  failed = true;
                  failureMessage = `Error messages don't match expected pattern /${test.error.message}/:\nInterpreter: ${result.interpreterResult.error}\nCompiler: ${result.compilerResult.error}`;
                }
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
              if (test.error) {
                failed = true;
                failureMessage = `Expected error matching /${test.error.message}/ but interpreter succeeded`;
              } else if (Array.isArray(test.expected) && JSON.stringify(result.interpreterResult.value) !== JSON.stringify(test.expected)) {
                failed = true;
                failureMessage = `Expected: ${JSON.stringify(test.expected)}, Got: ${JSON.stringify(result.interpreterResult.value)}`;
              }
            } else if (!test.expectedError && !test.error) {
              failed = true;
              failureMessage = `Interpreter failed: ${result.interpreterResult.error}`;
            } else if (test.error) {
              // Check if error matches expected pattern
              const matches = new RegExp(test.error.message).test(result.interpreterResult.error || '');
              if (!matches) {
                failed = true;
                failureMessage = `Interpreter error doesn't match expected pattern /${test.error.message}/: ${result.interpreterResult.error}`;
              }
            }
          } else if (result.compilerResult) {
            // Only compiler test
            if (result.compilerResult.success) {
              if (test.error) {
                failed = true;
                failureMessage = `Expected error matching /${test.error.message}/ but compiler succeeded`;
              } else if (Array.isArray(test.expected) && JSON.stringify(result.compilerResult.value) !== JSON.stringify(test.expected)) {
                failed = true;
                failureMessage = `Expected: ${JSON.stringify(test.expected)}, Got: ${JSON.stringify(result.compilerResult.value)}`;
              }
            } else if (!test.expectedError && !test.error) {
              failed = true;
              failureMessage = `Compiler failed: ${result.compilerResult.error}`;
            } else if (test.error) {
              // Check if error matches expected pattern
              const matches = new RegExp(test.error.message).test(result.compilerResult.error || '');
              if (!matches) {
                failed = true;
                failureMessage = `Compiler error doesn't match expected pattern /${test.error.message}/: ${result.compilerResult.error}`;
              }
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
