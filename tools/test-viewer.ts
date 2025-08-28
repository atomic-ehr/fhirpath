#!/usr/bin/env bun

import { readdir, readFile } from 'fs/promises';
import { join, basename } from 'path';

const PORT = 3456;
const TEST_CASES_DIR = join(import.meta.dir, '../test-cases');

interface TestCase {
  name: string;
  expression: string;
  input?: any;
  expected?: any;
  error?: any;
  tags?: string[];
  pending?: boolean | string;
}

interface TestSuite {
  name: string;
  description?: string;
  tests: TestCase[];
}

// Recursively find all JSON test files
async function findTestFiles(dir: string, basePath: string = ''): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
    
    if (entry.isDirectory()) {
      files.push(...await findTestFiles(fullPath, relativePath));
    } else if (entry.name.endsWith('.json')) {
      files.push(relativePath);
    }
  }
  
  return files.sort();
}

// Load a test suite from a file
async function loadTestSuite(path: string): Promise<TestSuite | null> {
  try {
    const content = await readFile(join(TEST_CASES_DIR, path), 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading ${path}:`, error);
    return null;
  }
}

// Generate HTML for the main page
function generateHTML(testFiles: string[], selectedFile?: string, testSuite?: TestSuite | null) {
  const sidebarItems = testFiles.map(file => {
    const isSelected = file === selectedFile;
    const displayName = file.replace('.json', '');
    return `
      <a href="/?file=${encodeURIComponent(file)}" 
         class="block px-4 py-2 text-sm hover:bg-gray-300 transition-colors ${
           isSelected ? 'bg-white border-l-4 border-blue-500 font-medium' : ''
         }"
         hx-get="/suite?file=${encodeURIComponent(file)}"
         hx-target="#main-content"
         hx-push-url="/?file=${encodeURIComponent(file)}">
        ${displayName}
      </a>
    `;
  }).join('');

  const mainContent = testSuite ? generateTestSuiteHTML(testSuite) : `
    <div class="flex items-center justify-center h-full text-gray-400">
      <div class="text-center">
        <svg class="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
        </svg>
        <p class="text-lg">Select a test suite from the sidebar</p>
      </div>
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html lang="en" class="h-full">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>FHIRPath Test Case Viewer</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <script src="https://unpkg.com/htmx.org@1.9.10"></script>
      <style>
        .json-container { 
          max-height: 300px; 
          overflow-y: auto;
        }
        pre { 
          white-space: pre-wrap; 
          word-wrap: break-word; 
        }
        .test-card {
          transition: all 0.2s ease;
        }
        .test-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
      </style>
    </head>
    <body class="h-full bg-gray-100">
      <div class="flex h-full">
        <!-- Sidebar -->
        <div class="w-80 bg-gray-200 text-gray-800 overflow-y-auto border-r border-gray-300">
          <div class="p-4 bg-white border-b border-gray-300">
            <h1 class="text-xl font-bold flex items-center gap-2">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              FHIRPath Test Cases
            </h1>
            <p class="text-sm text-gray-600 mt-1">${testFiles.length} test suites</p>
          </div>
          <nav class="py-2">
            ${sidebarItems}
          </nav>
        </div>
        
        <!-- Main Content -->
        <div class="flex-1 overflow-y-auto" id="main-content">
          ${mainContent}
        </div>
      </div>
    </body>
    </html>
  `;
}

// Generate HTML for a test suite
function generateTestSuiteHTML(suite: TestSuite): string {
  const totalTests = suite.tests?.length || 0;
  const pendingTests = suite.tests?.filter(t => t.pending).length || 0;
  const errorTests = suite.tests?.filter(t => t.error).length || 0;
  const normalTests = totalTests - pendingTests - errorTests;

  const testCards = suite.tests?.map((test, index) => {
    const isPending = !!test.pending;
    const isError = !!test.error;
    
    const statusBadge = isPending 
      ? '<span class="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">PENDING</span>'
      : isError 
      ? '<span class="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">ERROR</span>'
      : '<span class="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">NORMAL</span>';
    
    const tags = test.tags?.map(tag => 
      `<span class="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">${tag}</span>`
    ).join(' ') || '';
    
    return `
      <div class="test-card bg-white rounded-lg shadow-md p-6 mb-4">
        <div class="flex justify-between items-start mb-3">
          <h3 class="text-lg font-semibold text-gray-800">${test.name}</h3>
          ${statusBadge}
        </div>
        
        <div class="mb-3">
          <label class="block text-sm font-medium text-gray-600 mb-1">Expression:</label>
          <div class="flex flex-wrap items-center gap-2">
            ${test.input !== undefined ? `
            <div class="inline-block px-3 py-2 bg-blue-50 border border-blue-200 rounded">
              <code class="text-blue-700 text-sm font-mono">${JSON.stringify(test.input)}</code>
            </div>
            ` : ''}
            
            <div class="inline-block px-3 py-2 bg-gray-100 border border-gray-300 rounded">
              <code class="text-gray-900 text-sm font-mono font-semibold">${escapeHtml(test.expression)}</code>
            </div>
            
            ${(test.expected !== undefined && !test.error) ? `
            <span class="text-gray-400 text-lg">→</span>
            <div class="inline-block px-3 py-2 bg-green-50 border border-green-200 rounded">
              <code class="text-green-700 text-sm font-mono">${JSON.stringify(test.expected)}</code>
            </div>
            ` : ''}
            
            ${test.error ? `
            <span class="text-gray-400 text-lg">→</span>
            <div class="inline-block px-3 py-2 bg-red-50 border border-red-200 rounded">
              <code class="text-red-600 text-sm font-mono font-medium">ERROR</code>
            </div>
            ` : ''}
          </div>
        </div>
        
        ${test.error ? `
        <div class="mb-3">
          <label class="block text-sm font-medium text-gray-600 mb-1">Expected Error:</label>
          <div class="bg-red-50 p-3 rounded border border-red-200">
            <pre class="text-xs text-red-700">${JSON.stringify(test.error, null, 2)}</pre>
          </div>
        </div>
        ` : ''}
        
        ${test.pending ? `
        <div class="mb-3">
          <label class="block text-sm font-medium text-gray-600 mb-1">Pending Reason:</label>
          <div class="bg-yellow-50 p-3 rounded border border-yellow-200">
            <p class="text-sm text-yellow-800">${typeof test.pending === 'string' ? test.pending : 'Pending'}</p>
          </div>
        </div>
        ` : ''}
        
        ${tags ? `
        <div class="mt-3 flex flex-wrap gap-1">
          ${tags}
        </div>
        ` : ''}
      </div>
    `;
  }).join('') || '<p class="text-gray-500">No tests in this suite</p>';

  return `
    <div class="p-6">
      <div class="mb-6 bg-white rounded-lg shadow-md p-6">
        <h2 class="text-2xl font-bold text-gray-800 mb-2">${suite.name}</h2>
        ${suite.description ? `<p class="text-gray-600 mb-4">${suite.description}</p>` : ''}
        
        <div class="flex gap-4 text-sm">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 bg-green-500 rounded-full"></div>
            <span class="text-gray-600">Normal: ${normalTests}</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 bg-red-500 rounded-full"></div>
            <span class="text-gray-600">Error: ${errorTests}</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span class="text-gray-600">Pending: ${pendingTests}</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span class="text-gray-600">Total: ${totalTests}</span>
          </div>
        </div>
      </div>
      
      <div>
        ${testCards}
      </div>
    </div>
  `;
}

// Escape HTML special characters
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, m => map[m] || m);
}

// Start the server
Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    
    // Handle suite loading for HTMX requests
    if (url.pathname === '/suite') {
      const file = url.searchParams.get('file');
      if (file) {
        const suite = await loadTestSuite(file);
        if (suite) {
          return new Response(generateTestSuiteHTML(suite), {
            headers: { 'Content-Type': 'text/html' },
          });
        }
      }
      return new Response('Suite not found', { status: 404 });
    }
    
    // Main page
    if (url.pathname === '/') {
      const testFiles = await findTestFiles(TEST_CASES_DIR);
      const selectedFile = url.searchParams.get('file') || undefined;
      let testSuite: TestSuite | null = null;
      
      if (selectedFile) {
        testSuite = await loadTestSuite(selectedFile);
      }
      
      return new Response(generateHTML(testFiles, selectedFile, testSuite), {
        headers: { 'Content-Type': 'text/html' },
      });
    }
    
    return new Response('Not found', { status: 404 });
  },
});

console.log(`🚀 Test Case Viewer running at http://localhost:${PORT}`);
console.log(`📁 Serving test cases from: ${TEST_CASES_DIR}`);
console.log('\nPress Ctrl+C to stop the server');