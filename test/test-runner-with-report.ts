#!/usr/bin/env bun

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
  passed?: boolean;
  failed?: boolean;
}

// Load all test data from the test-cases directory
function loadTestData(): TestSuite[] {
  const testDataDir = join(__dirname, '../test-cases');
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
    const interpreter = new Interpreter();
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
    const compiler = new Compiler();
    const compiled = compiler.compile(ast);
    
    // Convert Context to RuntimeContext
    const runtimeEnv: Record<string, any> = { ...context.env };
    
    // Copy variables from Context.variables to env
    for (const key in context.variables) {
      if (Object.prototype.hasOwnProperty.call(context.variables, key)) {
        runtimeEnv[key] = context.variables[key]!;
      }
    }
    
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

// Helper function to escape HTML
function escapeHtml(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = results.filter(r => r.failed).length;
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
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      color: #333;
      font-size: 14px;
      line-height: 1.5;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      font-size: 24px;
      font-weight: 600;
      text-align: center;
      margin-bottom: 20px;
      color: #000;
    }
    
    /* Stats */
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
      margin-bottom: 20px;
    }
    .stat {
      background: white;
      border: 1px solid #ddd;
      padding: 15px;
      text-align: center;
    }
    .stat-label {
      font-size: 11px;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 5px;
    }
    .stat-value {
      font-size: 28px;
      font-weight: 600;
      color: #000;
    }
    .stat-percent {
      font-size: 11px;
      color: #666;
    }
    .stat.failed .stat-value { color: #000; }
    
    /* Filter buttons */
    .filters {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .filter-btn {
      padding: 6px 12px;
      border: 1px solid #ccc;
      background: white;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
    }
    .filter-btn:hover {
      background: #f0f0f0;
    }
    .filter-btn.active {
      background: #333;
      color: white;
      border-color: #333;
    }
    
    /* Test suites */
    details {
      background: white;
      border: 1px solid #ddd;
      margin-bottom: 8px;
    }
    summary {
      cursor: pointer;
      padding: 10px;
      list-style: none;
      user-select: none;
    }
    summary::-webkit-details-marker {
      display: none;
    }
    
    /* Suite summary */
    .suite-summary {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #fafafa;
    }
    .suite-name {
      font-weight: 600;
      font-size: 14px;
    }
    .suite-stats {
      display: flex;
      gap: 12px;
      font-size: 12px;
      color: #666;
    }
    .suite-stats span {
      font-weight: 500;
    }
    
    /* Test summary - single line */
    .test-summary {
      display: grid;
      grid-template-columns: 20px minmax(200px, 1fr) 2fr auto;
      gap: 10px;
      align-items: center;
      padding: 8px 10px;
      font-size: 12px;
      border-top: 1px solid #eee;
    }
    .test-summary:hover {
      background: #fafafa;
    }
    details.test[open] .test-summary {
      background: #f5f5f5;
      border-bottom: 1px solid #ddd;
    }
    
    /* Arrow */
    .test-arrow {
      width: 8px;
      height: 8px;
      border-right: 1px solid #666;
      border-bottom: 1px solid #666;
      transform: rotate(-45deg);
      transition: transform 0.2s;
    }
    details.test[open] .test-arrow {
      transform: rotate(45deg);
    }
    
    .test-name {
      font-weight: 500;
      color: #000;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .test-expression {
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 11px;
      color: #555;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .test-status {
      padding: 2px 8px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .test-status.passed {
      background: #e8e8e8;
      color: #333;
    }
    .test-status.failed {
      background: #333;
      color: white;
    }
    .test-status.skipped {
      background: #f0f0f0;
      color: #999;
    }
    
    /* Test details */
    .test-details {
      padding: 15px;
      background: #fafafa;
      border-top: 1px solid #ddd;
      font-size: 12px;
    }
    .detail-section {
      margin-bottom: 15px;
    }
    .detail-section:last-child {
      margin-bottom: 0;
    }
    .detail-label {
      font-weight: 600;
      margin-bottom: 5px;
      color: #333;
      font-size: 11px;
      text-transform: uppercase;
    }
    .detail-content {
      background: white;
      border: 1px solid #ddd;
      padding: 10px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 11px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }
    
    .results-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 10px;
      margin-bottom: 15px;
    }
    .result-box {
      background: white;
      border: 1px solid #ddd;
      padding: 10px;
    }
    .result-box.error {
      border-left: 3px solid #333;
    }
    .result-box.success {
      border-left: 3px solid #ccc;
    }
    .result-header {
      font-weight: 600;
      margin-bottom: 5px;
      font-size: 11px;
      text-transform: uppercase;
    }
    .result-content {
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 11px;
      color: #555;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .result-time {
      font-size: 10px;
      color: #999;
      margin-top: 5px;
    }
    .error-message {
      color: #000;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>FHIRPath Test Results</h1>
    
    <div class="stats">
      <div class="stat">
        <div class="stat-label">Total</div>
        <div class="stat-value">${totalTests}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Passed</div>
        <div class="stat-value">${passedTests}</div>
        <div class="stat-percent">${((passedTests / totalTests) * 100).toFixed(1)}%</div>
      </div>
      <div class="stat failed">
        <div class="stat-label">Failed</div>
        <div class="stat-value">${failedTests}</div>
        <div class="stat-percent">${((failedTests / totalTests) * 100).toFixed(1)}%</div>
      </div>
      <div class="stat">
        <div class="stat-label">Skipped</div>
        <div class="stat-value">${skippedTests}</div>
        <div class="stat-percent">${((skippedTests / totalTests) * 100).toFixed(1)}%</div>
      </div>
    </div>
    
    <div class="filters">
      <button class="filter-btn active" onclick="filterTests('all')">All Tests</button>
      <button class="filter-btn" onclick="filterTests('failed')">Failed Only</button>
      <button class="filter-btn" onclick="filterTests('passed')">Passed Only</button>
      <button class="filter-btn" onclick="filterTests('skipped')">Skipped Only</button>
    </div>
    
    ${Array.from(resultsBySuite.entries()).map(([suiteName, suiteResults]) => {
      const suitePassed = suiteResults.filter(r => r.passed).length;
      const suiteFailed = suiteResults.filter(r => r.failed).length;
      const suiteSkipped = suiteResults.filter(r => r.test.skip?.interpreter || r.test.skip?.compiler).length;
      
      return `
    <details class="suite" data-suite="${suiteName}" ${suiteFailed > 0 ? 'open' : ''}>
      <summary class="suite-summary">
        <div class="suite-name">${suiteName}</div>
        <div class="suite-stats">
          <span>✓ ${suitePassed}</span>
          <span>✗ ${suiteFailed}</span>
          ${suiteSkipped > 0 ? `<span>⊘ ${suiteSkipped}</span>` : ''}
          <span>Total: ${suiteResults.length}</span>
        </div>
      </summary>
      <div>
        ${suiteResults.map(result => {
          let status = 'passed';
          
          if (result.test.skip?.interpreter || result.test.skip?.compiler) {
            status = 'skipped';
          } else if (result.failed) {
            status = 'failed';
          } else if (result.passed) {
            status = 'passed';
          }
          
          // Get a compact result representation
          let resultDisplay = '';
          if (result.interpreterResult && result.interpreterResult.success) {
            resultDisplay = JSON.stringify(result.interpreterResult.value);
          } else if (result.compilerResult && result.compilerResult.success) {
            resultDisplay = JSON.stringify(result.compilerResult.value);
          } else if (result.interpreterResult && !result.interpreterResult.success) {
            resultDisplay = 'Error: ' + (result.interpreterResult.error || 'Unknown');
          } else if (result.compilerResult && !result.compilerResult.success) {
            resultDisplay = 'Error: ' + (result.compilerResult.error || 'Unknown');
          }
          
          return `
        <details class="test" data-status="${status}" ${status === 'failed' ? 'open' : ''}>
          <summary class="test-summary">
            <div class="test-arrow"></div>
            <div class="test-name" title="${escapeHtml(result.test.name)}">${result.test.name}</div>
            <div class="test-expression" title="${escapeHtml(result.test.expression)}">${escapeHtml(result.test.expression)}</div>
            <div class="test-status ${status}">${status}</div>
          </summary>
          
          <div class="test-details">
            <div class="detail-section">
              <div class="detail-label">Input</div>
              <div class="detail-content">${escapeHtml(JSON.stringify(result.test.input, null, 2))}</div>
            </div>
            
            <div class="detail-section">
              <div class="detail-label">Expected</div>
              <div class="detail-content">${escapeHtml(JSON.stringify(result.test.expected, null, 2))}</div>
            </div>
            
            <div class="results-grid">
              ${result.interpreterResult ? `
              <div class="result-box ${result.interpreterResult.success && JSON.stringify(result.interpreterResult.value) === JSON.stringify(result.test.expected) ? 'success' : 'error'}">
                <div class="result-header">Interpreter</div>
                ${result.interpreterResult.success ? `
                  <div class="result-content">${escapeHtml(JSON.stringify(result.interpreterResult.value, null, 2))}</div>
                  <div class="result-time">Time: ${result.interpreterResult.time.toFixed(2)}ms</div>
                ` : `
                  <div class="result-content error-message">${escapeHtml(result.interpreterResult.error || 'Unknown error')}</div>
                `}
              </div>
              ` : ''}
              
              ${result.compilerResult ? `
              <div class="result-box ${result.compilerResult.success && JSON.stringify(result.compilerResult.value) === JSON.stringify(result.test.expected) ? 'success' : 'error'}">
                <div class="result-header">Compiler</div>
                ${result.compilerResult.success ? `
                  <div class="result-content">${escapeHtml(JSON.stringify(result.compilerResult.value, null, 2))}</div>
                  <div class="result-time">Time: ${result.compilerResult.time.toFixed(2)}ms</div>
                ` : `
                  <div class="result-content error-message">${escapeHtml(result.compilerResult.error || 'Unknown error')}</div>
                `}
              </div>
              ` : ''}
            </div>
            
            ${result.test.skip ? `
            <div class="detail-section">
              <div class="detail-label">Skip Reason</div>
              <div class="detail-content">${escapeHtml(result.test.skip.reason || 'No reason provided')}</div>
            </div>
            ` : ''}
            
            ${result.test.tags && result.test.tags.length > 0 ? `
            <div class="detail-section">
              <div class="detail-label">Tags</div>
              <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                ${result.test.tags.map(tag => `<span style="padding: 2px 8px; background: #eee; font-size: 11px;">${escapeHtml(tag)}</span>`).join('')}
              </div>
            </div>
            ` : ''}
          </div>
        </details>
          `;
        }).join('')}
      </div>
    </details>
      `;
    }).join('')}
  </div>
  
  <script>
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
  </script>
</body>
</html>`;
  
  // Write HTML file
  const outputPath = join(outputDir, 'test-results.html');
  writeFileSync(outputPath, html);
  
  console.log(`\nHTML report generated at: ${outputPath}`);
  
  // Also generate a JSON report for programmatic access
  const jsonReport = {
    summary: {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      skipped: skippedTests,
      timestamp: new Date().toISOString()
    },
    results: results
  };
  
  const jsonPath = join(outputDir, 'test-results.json');
  writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
  console.log(`JSON report generated at: ${jsonPath}`);
}

// Main execution
console.log('Running FHIRPath tests...\n');

const testSuites = loadTestData();
const results: TestResult[] = [];
let totalPassed = 0;
let totalFailed = 0;

testSuites.forEach(suite => {
  console.log(`\nRunning suite: ${suite.name}`);
  
  suite.tests.forEach(test => {
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

    // Determine if test passed or failed
    let passed = false;
    
    if (result.interpreterResult && result.compilerResult) {
      if (result.interpreterResult.success && result.compilerResult.success) {
        result.matched = compareResults(
          test,
          result.interpreterResult.value,
          result.compilerResult.value
        );
        
        passed = result.matched &&
          JSON.stringify(result.interpreterResult.value) === JSON.stringify(test.expected) &&
          JSON.stringify(result.compilerResult.value) === JSON.stringify(test.expected);
      } else if (!result.interpreterResult.success && !result.compilerResult.success && test.expectedError) {
        // Both failed as expected
        passed = true;
      }
    } else if (result.interpreterResult) {
      if (result.interpreterResult.success) {
        passed = JSON.stringify(result.interpreterResult.value) === JSON.stringify(test.expected);
      } else if (test.expectedError) {
        passed = true;
      }
    } else if (result.compilerResult) {
      if (result.compilerResult.success) {
        passed = JSON.stringify(result.compilerResult.value) === JSON.stringify(test.expected);
      } else if (test.expectedError) {
        passed = true;
      }
    }

    result.passed = passed;
    result.failed = !passed && !test.skip?.interpreter && !test.skip?.compiler;

    if (passed) {
      totalPassed++;
      process.stdout.write('.');
    } else if (result.failed) {
      totalFailed++;
      process.stdout.write('F');
    } else {
      process.stdout.write('S');
    }

    results.push(result);
  });
});

console.log(`\n\nTest Results: ${totalPassed} passed, ${totalFailed} failed, ${results.length} total`);

// Generate report
generateHTMLReport(results);

// Exit with appropriate code
process.exit(totalFailed > 0 ? 1 : 0);