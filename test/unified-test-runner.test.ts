import { describe, it, expect, beforeEach, afterAll } from 'bun:test';
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from 'fs';
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

// Generate HTML report
function generateHTMLReport(results: TestResult[]) {
  const outputDir = join(__dirname, '..', 'test-output');
  
  // Create output directory if it doesn't exist
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  // Group results by suite
  const resultsBySuite = new Map<string, TestResult[]>();
  results.forEach(result => {
    if (!resultsBySuite.has(result.suite)) {
      resultsBySuite.set(result.suite, []);
    }
    resultsBySuite.get(result.suite)!.push(result);
  });
  
  // Calculate statistics
  const totalTests = results.length;
  const passedTests = results.filter(r => {
    if (r.interpreterResult && r.compilerResult) {
      return r.interpreterResult.success && r.compilerResult.success && r.matched &&
        JSON.stringify(r.interpreterResult.value) === JSON.stringify(r.test.expected) &&
        JSON.stringify(r.compilerResult.value) === JSON.stringify(r.test.expected);
    } else if (r.interpreterResult) {
      return r.interpreterResult.success && 
        JSON.stringify(r.interpreterResult.value) === JSON.stringify(r.test.expected);
    } else if (r.compilerResult) {
      return r.compilerResult.success &&
        JSON.stringify(r.compilerResult.value) === JSON.stringify(r.test.expected);
    }
    return false;
  }).length;
  
  const failedTests = results.filter(r => {
    if (r.interpreterResult && r.compilerResult) {
      return !r.interpreterResult.success || !r.compilerResult.success || !r.matched ||
        JSON.stringify(r.interpreterResult.value) !== JSON.stringify(r.test.expected) ||
        JSON.stringify(r.compilerResult.value) !== JSON.stringify(r.test.expected);
    } else if (r.interpreterResult) {
      return !r.interpreterResult.success || 
        JSON.stringify(r.interpreterResult.value) !== JSON.stringify(r.test.expected);
    } else if (r.compilerResult) {
      return !r.compilerResult.success ||
        JSON.stringify(r.compilerResult.value) !== JSON.stringify(r.test.expected);
    }
    return false;
  });
  
  const skippedTests = results.filter(r => 
    r.test.skip?.interpreter || r.test.skip?.compiler
  ).length;
  
  // Generate HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FHIRPath Test Results</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background-color: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      margin-bottom: 30px;
      text-align: center;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .summary-card {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      border: 2px solid transparent;
    }
    .summary-card.passed {
      border-color: #28a745;
    }
    .summary-card.failed {
      border-color: #dc3545;
    }
    .summary-card.skipped {
      border-color: #ffc107;
    }
    .summary-card.total {
      border-color: #007bff;
    }
    .summary-card h3 {
      margin: 0 0 10px 0;
      color: #666;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .summary-card .number {
      font-size: 36px;
      font-weight: bold;
      margin: 0;
    }
    .summary-card .percentage {
      font-size: 14px;
      color: #999;
    }
    .filters {
      margin-bottom: 30px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .filter-btn {
      padding: 8px 16px;
      border: 1px solid #ddd;
      background: white;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .filter-btn:hover {
      background: #f8f9fa;
    }
    .filter-btn.active {
      background: #007bff;
      color: white;
      border-color: #007bff;
    }
    .suite {
      margin-bottom: 30px;
      border: 1px solid #ddd;
      border-radius: 8px;
      overflow: hidden;
    }
    .suite-header {
      background: #f8f9fa;
      padding: 15px 20px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .suite-header:hover {
      background: #e9ecef;
    }
    .suite-header h2 {
      margin: 0;
      font-size: 18px;
    }
    .suite-stats {
      display: flex;
      gap: 15px;
      font-size: 14px;
    }
    .suite-content {
      display: none;
    }
    .suite.expanded .suite-content {
      display: block;
    }
    .test {
      border-bottom: 1px solid #eee;
      padding: 20px;
    }
    .test:last-child {
      border-bottom: none;
    }
    .test.passed {
      background: #f8fff9;
    }
    .test.failed {
      background: #fff8f8;
    }
    .test.skipped {
      background: #fffef8;
      opacity: 0.7;
    }
    .test-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 15px;
    }
    .test-name {
      font-weight: 600;
      margin: 0;
      flex: 1;
    }
    .test-status {
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .test-status.passed {
      background: #28a745;
      color: white;
    }
    .test-status.failed {
      background: #dc3545;
      color: white;
    }
    .test-status.skipped {
      background: #ffc107;
      color: #333;
    }
    .test-expression {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      margin-bottom: 15px;
      overflow-x: auto;
    }
    .test-details {
      display: grid;
      gap: 15px;
    }
    .test-section {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 4px;
    }
    .test-section h4 {
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #666;
    }
    .test-section pre {
      margin: 0;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      overflow-x: auto;
      white-space: pre-wrap;
    }
    .test-results {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    .result-box {
      background: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 15px;
    }
    .result-box h5 {
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #666;
    }
    .result-box.success {
      border-color: #28a745;
    }
    .result-box.error {
      border-color: #dc3545;
    }
    .error-message {
      color: #dc3545;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      margin-top: 10px;
    }
    .performance {
      font-size: 12px;
      color: #999;
      margin-top: 5px;
    }
    .tags {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
      margin-top: 10px;
    }
    .tag {
      background: #e9ecef;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 11px;
      color: #666;
    }
    @media (max-width: 768px) {
      .test-results {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>FHIRPath Test Results</h1>
    
    <div class="summary">
      <div class="summary-card total">
        <h3>Total Tests</h3>
        <p class="number">${totalTests}</p>
      </div>
      <div class="summary-card passed">
        <h3>Passed</h3>
        <p class="number">${passedTests}</p>
        <p class="percentage">${((passedTests / totalTests) * 100).toFixed(1)}%</p>
      </div>
      <div class="summary-card failed">
        <h3>Failed</h3>
        <p class="number">${failedTests.length}</p>
        <p class="percentage">${((failedTests.length / totalTests) * 100).toFixed(1)}%</p>
      </div>
      <div class="summary-card skipped">
        <h3>Skipped</h3>
        <p class="number">${skippedTests}</p>
        <p class="percentage">${((skippedTests / totalTests) * 100).toFixed(1)}%</p>
      </div>
    </div>
    
    <div class="filters">
      <button class="filter-btn active" onclick="filterTests('all')">All Tests</button>
      <button class="filter-btn" onclick="filterTests('failed')">Failed Only</button>
      <button class="filter-btn" onclick="filterTests('passed')">Passed Only</button>
      <button class="filter-btn" onclick="filterTests('skipped')">Skipped Only</button>
    </div>
    
    ${Array.from(resultsBySuite.entries()).map(([suiteName, suiteResults]) => {
      const suitePassed = suiteResults.filter(r => {
        if (r.interpreterResult && r.compilerResult) {
          return r.interpreterResult.success && r.compilerResult.success && r.matched &&
            JSON.stringify(r.interpreterResult.value) === JSON.stringify(r.test.expected);
        } else if (r.interpreterResult) {
          return r.interpreterResult.success && 
            JSON.stringify(r.interpreterResult.value) === JSON.stringify(r.test.expected);
        } else if (r.compilerResult) {
          return r.compilerResult.success &&
            JSON.stringify(r.compilerResult.value) === JSON.stringify(r.test.expected);
        }
        return false;
      }).length;
      
      const suiteFailed = suiteResults.length - suitePassed;
      
      return `
    <div class="suite" data-suite="${suiteName}">
      <div class="suite-header" onclick="toggleSuite(this)">
        <h2>${suiteName}</h2>
        <div class="suite-stats">
          <span style="color: #28a745;">✓ ${suitePassed}</span>
          <span style="color: #dc3545;">✗ ${suiteFailed}</span>
          <span>Total: ${suiteResults.length}</span>
        </div>
      </div>
      <div class="suite-content">
        ${suiteResults.map(result => {
          let status = 'passed';
          let passed = false;
          
          if (result.test.skip?.interpreter || result.test.skip?.compiler) {
            status = 'skipped';
          } else if (result.interpreterResult && result.compilerResult) {
            passed = result.interpreterResult.success && result.compilerResult.success && result.matched &&
              JSON.stringify(result.interpreterResult.value) === JSON.stringify(result.test.expected);
            status = passed ? 'passed' : 'failed';
          } else if (result.interpreterResult) {
            passed = result.interpreterResult.success && 
              JSON.stringify(result.interpreterResult.value) === JSON.stringify(result.test.expected);
            status = passed ? 'passed' : 'failed';
          } else if (result.compilerResult) {
            passed = result.compilerResult.success &&
              JSON.stringify(result.compilerResult.value) === JSON.stringify(result.test.expected);
            status = passed ? 'passed' : 'failed';
          }
          
          return `
        <div class="test ${status}" data-status="${status}">
          <div class="test-header">
            <h3 class="test-name">${result.test.name}</h3>
            <span class="test-status ${status}">${status}</span>
          </div>
          
          <div class="test-expression">
            ${escapeHtml(result.test.expression)}
          </div>
          
          <div class="test-details">
            <div class="test-section">
              <h4>Input</h4>
              <pre>${escapeHtml(JSON.stringify(result.test.input, null, 2))}</pre>
            </div>
            
            <div class="test-section">
              <h4>Expected</h4>
              <pre>${escapeHtml(JSON.stringify(result.test.expected, null, 2))}</pre>
            </div>
            
            <div class="test-results">
              ${result.interpreterResult ? `
              <div class="result-box ${result.interpreterResult.success ? 'success' : 'error'}">
                <h5>Interpreter Result</h5>
                ${result.interpreterResult.success ? `
                  <pre>${escapeHtml(JSON.stringify(result.interpreterResult.value, null, 2))}</pre>
                  <p class="performance">Time: ${result.interpreterResult.time.toFixed(2)}ms</p>
                ` : `
                  <p class="error-message">${escapeHtml(result.interpreterResult.error || 'Unknown error')}</p>
                `}
              </div>
              ` : ''}
              
              ${result.compilerResult ? `
              <div class="result-box ${result.compilerResult.success ? 'success' : 'error'}">
                <h5>Compiler Result</h5>
                ${result.compilerResult.success ? `
                  <pre>${escapeHtml(JSON.stringify(result.compilerResult.value, null, 2))}</pre>
                  <p class="performance">Time: ${result.compilerResult.time.toFixed(2)}ms</p>
                ` : `
                  <p class="error-message">${escapeHtml(result.compilerResult.error || 'Unknown error')}</p>
                `}
              </div>
              ` : ''}
            </div>
            
            ${result.test.skip ? `
            <div class="test-section">
              <h4>Skip Reason</h4>
              <p>${escapeHtml(result.test.skip.reason || 'No reason provided')}</p>
            </div>
            ` : ''}
            
            ${result.test.tags && result.test.tags.length > 0 ? `
            <div class="tags">
              ${result.test.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
            </div>
            ` : ''}
          </div>
        </div>
          `;
        }).join('')}
      </div>
    </div>
      `;
    }).join('')}
  </div>
  
  <script>
    function toggleSuite(header) {
      header.parentElement.classList.toggle('expanded');
    }
    
    function filterTests(status) {
      // Update active button
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      event.target.classList.add('active');
      
      // Filter tests
      const tests = document.querySelectorAll('.test');
      tests.forEach(test => {
        if (status === 'all' || test.dataset.status === status) {
          test.style.display = 'block';
        } else {
          test.style.display = 'none';
        }
      });
      
      // Update suite visibility
      document.querySelectorAll('.suite').forEach(suite => {
        const visibleTests = suite.querySelectorAll('.test[style="display: block;"], .test:not([style])');
        if (status === 'all' || visibleTests.length > 0) {
          suite.style.display = 'block';
        } else {
          suite.style.display = 'none';
        }
      });
    }
    
    // Auto-expand suites with failed tests
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('.suite').forEach(suite => {
        const failedTests = suite.querySelectorAll('.test.failed');
        if (failedTests.length > 0) {
          suite.classList.add('expanded');
        }
      });
    });
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  </script>
</body>
</html>`;
  
  // Helper function to escape HTML
  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  
  // Write HTML file
  const outputPath = join(outputDir, 'test-results.html');
  writeFileSync(outputPath, html);
  
  console.log(`\nHTML report generated at: ${outputPath}`);
  
  // Also generate a JSON report for programmatic access
  const jsonReport = {
    summary: {
      total: totalTests,
      passed: passedTests,
      failed: failedTests.length,
      skipped: skippedTests,
      timestamp: new Date().toISOString()
    },
    results: results
  };
  
  const jsonPath = join(outputDir, 'test-results.json');
  writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
  console.log(`JSON report generated at: ${jsonPath}`);
}

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
    
    // Generate HTML report
    generateHTMLReport(results);
    
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