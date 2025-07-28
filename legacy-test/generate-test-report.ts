#!/usr/bin/env bun

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

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
  failed?: boolean;
}

// Helper function to escape HTML
function escapeHtml(text: string): string {
  return text
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
  const passedTests = results.filter(r => !r.failed && !r.test.skip?.interpreter && !r.test.skip?.compiler).length;
  const failedTests = results.filter(r => r.failed).length;
  const skippedTests = results.filter(r => r.test.skip?.interpreter || r.test.skip?.compiler).length;
  
  // Generate HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FHIRPath Test Results</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            'test-pass': '#10b981',
            'test-fail': '#ef4444',
            'test-skip': '#f59e0b',
          }
        }
      }
    }
  </script>
  <style>
    /* Hide default arrow for details/summary */
    summary::-webkit-details-marker {
      display: none;
    }
    summary {
      list-style: none;
    }
    /* Add custom arrow for suite summaries */
    details.suite > summary::before {
      content: '▶';
      display: inline-block;
      margin-right: 0.5rem;
      transition: transform 0.2s;
    }
    details.suite[open] > summary::before {
      transform: rotate(90deg);
    }
    /* Add custom arrow for test summaries */
    details.test > summary::before {
      content: '▸';
      display: inline-block;
      margin-right: 0.5rem;
      font-size: 0.8em;
      transition: transform 0.2s;
    }
    details.test[open] > summary::before {
      transform: rotate(90deg);
    }
  </style>
</head>
<body class="bg-gray-50 text-gray-900">
  <div class="max-w-7xl mx-auto p-6">
    <h1 class="text-4xl font-bold text-center text-gray-800 mb-8">FHIRPath Test Results</h1>
    
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="bg-white rounded-lg shadow-md p-6 text-center border-2 border-blue-500">
        <h3 class="text-sm uppercase tracking-wide text-gray-600 mb-2">Total Tests</h3>
        <p class="text-4xl font-bold text-gray-800">${totalTests}</p>
      </div>
      <div class="bg-white rounded-lg shadow-md p-6 text-center border-2 border-test-pass">
        <h3 class="text-sm uppercase tracking-wide text-gray-600 mb-2">Passed</h3>
        <p class="text-4xl font-bold text-test-pass">${passedTests}</p>
        <p class="text-sm text-gray-500 mt-1">${totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0}%</p>
      </div>
      <div class="bg-white rounded-lg shadow-md p-6 text-center border-2 border-test-fail">
        <h3 class="text-sm uppercase tracking-wide text-gray-600 mb-2">Failed</h3>
        <p class="text-4xl font-bold text-test-fail">${failedTests}</p>
        <p class="text-sm text-gray-500 mt-1">${totalTests > 0 ? ((failedTests / totalTests) * 100).toFixed(1) : 0}%</p>
      </div>
      <div class="bg-white rounded-lg shadow-md p-6 text-center border-2 border-test-skip">
        <h3 class="text-sm uppercase tracking-wide text-gray-600 mb-2">Skipped</h3>
        <p class="text-4xl font-bold text-test-skip">${skippedTests}</p>
        <p class="text-sm text-gray-500 mt-1">${totalTests > 0 ? ((skippedTests / totalTests) * 100).toFixed(1) : 0}%</p>
      </div>
    </div>
    
    <div class="flex flex-wrap gap-2 mb-8">
      <button class="px-4 py-2 rounded-md border border-gray-300 bg-blue-500 text-white hover:bg-blue-600 transition-colors filter-btn active" onclick="filterTests('all')">All Tests</button>
      <button class="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 transition-colors filter-btn" onclick="filterTests('failed')">Failed Only</button>
      <button class="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 transition-colors filter-btn" onclick="filterTests('passed')">Passed Only</button>
      <button class="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 transition-colors filter-btn" onclick="filterTests('skipped')">Skipped Only</button>
    </div>
    
    ${Array.from(resultsBySuite.entries()).map(([suiteName, suiteResults]) => {
      const suitePassed = suiteResults.filter(r => !r.failed && !r.test.skip?.interpreter && !r.test.skip?.compiler).length;
      const suiteFailed = suiteResults.filter(r => r.failed).length;
      const suiteSkipped = suiteResults.filter(r => r.test.skip?.interpreter || r.test.skip?.compiler).length;
      
      return `
    <details class="bg-white rounded-lg shadow-md mb-6 overflow-hidden suite" data-suite="${suiteName}" ${suiteFailed > 0 ? 'open' : ''}>
      <summary class="bg-gray-100 px-6 py-4 cursor-pointer hover:bg-gray-200 transition-colors flex justify-between items-center">
        <h2 class="text-lg font-semibold text-gray-800">${suiteName}</h2>
        <div class="flex gap-4 text-sm">
          <span class="text-test-pass font-medium">✓ ${suitePassed}</span>
          <span class="text-test-fail font-medium">✗ ${suiteFailed}</span>
          <span class="text-test-skip font-medium">⊘ ${suiteSkipped}</span>
          <span class="text-gray-600">Total: ${suiteResults.length}</span>
        </div>
      </summary>
      <div class="p-0">
        ${suiteResults.map(result => {
          let status = 'passed';
          
          if (result.test.skip?.interpreter || result.test.skip?.compiler) {
            status = 'skipped';
          } else if (result.failed) {
            status = 'failed';
          }
          
          return `
        <details class="border-b border-gray-200 test" data-status="${status}" ${status === 'failed' ? 'open' : ''}>
          <summary class="p-6 cursor-pointer hover:bg-gray-50 transition-colors ${status === 'passed' ? 'bg-green-50' : status === 'failed' ? 'bg-red-50' : 'bg-yellow-50 opacity-75'}">
            <div class="flex justify-between items-center">
              <h3 class="text-base font-semibold text-gray-800 flex-1">${result.test.name}</h3>
              <span class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ml-4 ${status === 'passed' ? 'bg-test-pass text-white' : status === 'failed' ? 'bg-test-fail text-white' : 'bg-test-skip text-gray-800'}">${status}</span>
            </div>
            <div class="mt-3 bg-gray-100 p-3 rounded-md font-mono text-sm text-gray-800 overflow-x-auto">
              ${escapeHtml(result.test.expression)}
            </div>
          </summary>
          
          <div class="p-6 pt-0 space-y-4">
            <div class="bg-gray-100 p-4 rounded-md">
              <h4 class="text-sm font-medium text-gray-600 mb-2">Input</h4>
              <pre class="font-mono text-xs text-gray-800 overflow-x-auto whitespace-pre-wrap">${escapeHtml(JSON.stringify(result.test.input, null, 2))}</pre>
            </div>
            
            <div class="bg-gray-100 p-4 rounded-md">
              <h4 class="text-sm font-medium text-gray-600 mb-2">Expected</h4>
              <pre class="font-mono text-xs text-gray-800 overflow-x-auto whitespace-pre-wrap">${escapeHtml(JSON.stringify(result.test.expected, null, 2))}</pre>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${result.interpreterResult ? `
              <div class="bg-white border-2 ${result.interpreterResult.success && JSON.stringify(result.interpreterResult.value) === JSON.stringify(result.test.expected) ? 'border-test-pass' : 'border-test-fail'} rounded-md p-4">
                <h5 class="text-sm font-medium text-gray-600 mb-2">Interpreter Result</h5>
                ${result.interpreterResult.success ? `
                  <pre class="font-mono text-xs text-gray-800 overflow-x-auto whitespace-pre-wrap">${escapeHtml(JSON.stringify(result.interpreterResult.value, null, 2))}</pre>
                  <p class="text-xs text-gray-500 mt-2">Time: ${result.interpreterResult.time.toFixed(2)}ms</p>
                ` : `
                  <p class="font-mono text-xs text-test-fail mt-2">${escapeHtml(result.interpreterResult.error || 'Unknown error')}</p>
                `}
              </div>
              ` : ''}
              
              ${result.compilerResult ? `
              <div class="bg-white border-2 ${result.compilerResult.success && JSON.stringify(result.compilerResult.value) === JSON.stringify(result.test.expected) ? 'border-test-pass' : 'border-test-fail'} rounded-md p-4">
                <h5 class="text-sm font-medium text-gray-600 mb-2">Compiler Result</h5>
                ${result.compilerResult.success ? `
                  <pre class="font-mono text-xs text-gray-800 overflow-x-auto whitespace-pre-wrap">${escapeHtml(JSON.stringify(result.compilerResult.value, null, 2))}</pre>
                  <p class="text-xs text-gray-500 mt-2">Time: ${result.compilerResult.time.toFixed(2)}ms</p>
                ` : `
                  <p class="font-mono text-xs text-test-fail mt-2">${escapeHtml(result.compilerResult.error || 'Unknown error')}</p>
                `}
              </div>
              ` : ''}
            </div>
            
            ${result.test.skip ? `
            <div class="bg-gray-100 p-4 rounded-md">
              <h4 class="text-sm font-medium text-gray-600 mb-2">Skip Reason</h4>
              <p class="text-sm text-gray-800">${escapeHtml(result.test.skip.reason || 'No reason provided')}</p>
            </div>
            ` : ''}
            
            ${result.test.tags && result.test.tags.length > 0 ? `
            <div class="flex flex-wrap gap-1 mt-4">
              ${result.test.tags.map(tag => `<span class="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded">${escapeHtml(tag)}</span>`).join('')}
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
        btn.classList.remove('bg-blue-500', 'text-white', 'active');
        btn.classList.add('bg-white', 'text-gray-700');
      });
      event.target.classList.remove('bg-white', 'text-gray-700');
      event.target.classList.add('bg-blue-500', 'text-white', 'active');
      
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

// Run tests and capture output
console.log('Running tests and capturing results...');

const testProcess = spawn('bun', ['test', 'test/unified-test-runner.test.ts', '--reporter=json'], {
  shell: true
});

let output = '';
testProcess.stdout.on('data', (data) => {
  output += data.toString();
});

testProcess.stderr.on('data', (data) => {
  console.error(data.toString());
});

testProcess.on('close', (code) => {
  try {
    // Parse test output
    const lines = output.split('\n').filter(line => line.trim());
    const results: TestResult[] = [];
    
    // Simple parsing - look for test results in the output
    // This is a simplified version - you might need to adjust based on actual output format
    
    console.log(`\nTest run completed with code ${code}`);
    console.log(`Captured ${results.length} test results`);
    
    // For now, let's just create a dummy report to show the issue
    const dummyResults: TestResult[] = [
      {
        test: {
          name: "Example Failed Test",
          expression: "1 + 1",
          input: [1],
          expected: [3]
        },
        suite: "Example Suite",
        interpreterResult: {
          success: true,
          value: [2],
          time: 0.5
        },
        compilerResult: {
          success: true,
          value: [2],
          time: 0.1
        },
        matched: true,
        failed: true
      },
      {
        test: {
          name: "Example Passed Test",
          expression: "2 + 2",
          input: [2],
          expected: [4]
        },
        suite: "Example Suite",
        interpreterResult: {
          success: true,
          value: [4],
          time: 0.3
        },
        compilerResult: {
          success: true,
          value: [4],
          time: 0.1
        },
        matched: true,
        failed: false
      }
    ];
    
    generateHTMLReport(dummyResults);
    
  } catch (error) {
    console.error('Error processing test results:', error);
  }
  
  process.exit(code || 0);
});