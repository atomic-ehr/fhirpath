import { describe, it, expect } from 'bun:test';
import { readdirSync, statSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { loadTestSuite, runAndValidateTest } from '../tools/lib/test-helpers';

const TEST_CASES_DIR = join(process.cwd(), 'test-cases');

// Function to recursively find all JSON test files
function findTestFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (entry === 'input' || entry === 'node_modules') continue;
      files.push(...findTestFiles(fullPath));
    } else if (entry.endsWith('.json') && entry !== 'metadata.json') {
      files.push(fullPath);
    }
  }

  return files;
}

// Find all test files
const testFiles = findTestFiles(TEST_CASES_DIR);

// Group test files by directory
const testGroups = new Map<string, string[]>();
testFiles.forEach(file => {
  const relativePath = file.replace(TEST_CASES_DIR + '/', '');
  const parts = relativePath.split('/');
  const group = parts.length > 1 ? parts.slice(0, -1).join('/') : 'root';
  
  if (!testGroups.has(group)) {
    testGroups.set(group, []);
  }
  testGroups.get(group)!.push(file);
});

// Helper to load input file if specified
function loadInputFile(suite: any, testFilePath: string): any {
  if (!suite.inputFile) return undefined;
  
  try {
    const inputPath = join(testFilePath, '..', suite.inputFile);
    const inputContent = readFileSync(inputPath, 'utf-8');
    return JSON.parse(inputContent);
  } catch (error) {
    console.error(`Failed to load input file ${suite.inputFile}:`, error);
    return undefined;
  }
}

// Create test suites
describe('FHIRPath Test Cases', () => {
  testGroups.forEach((files, group) => {
    describe(group, () => {
      files.forEach(file => {
        const suite = loadTestSuite(file);
        const defaultInput = loadInputFile(suite, file);
        
        // Get relative path from test-cases directory for better context
        const relativePath = file.replace(TEST_CASES_DIR + '/', '');
        // Always show filename for clarity, along with suite name if it exists
        const testSuiteName = suite.name ? `${suite.name} (${basename(file)})` : relativePath;
        
        describe(testSuiteName, () => {
          suite.tests.forEach(test => {
            const testName = String(test.name || 'unnamed test');

            const testFn = async () => {
              // Use test's input or fall back to suite's inputFile
              const testWithInput = test.input ? test : { ...test, input: defaultInput };
              const result = await runAndValidateTest(testWithInput);

              if (result.pending || result.skipped) {
                // Bun doesn't have a direct way to mark a test as skipped from within the test function,
                // so we just return. The test will pass, but we can log the reason.
                if (result.reason) console.log(`SKIPPED: ${testName} - ${result.reason}`);
                return;
              }

              if (test.error) {
                expect(result.success).toBe(true);
                expect(result.expectedError).toBe(true);
              } else {
                if (!result.success) {
                  // Throw a detailed error message for failed tests
                  throw new Error(`Test failed: ${testName}\nExpression: ${test.expression}\nExpected: ${JSON.stringify(test.expected)}\nGot:      ${JSON.stringify(result.value)}\nError: ${result.error}`);
                }
                expect(result.success).toBe(true);
                // Only check value if test expects a value (not an error)
                if (test.expected !== undefined) {
                  expect(result.value).toEqual(test.expected);
                }
              }
            };

            // Register the test with Bun
            if (test.pending || (test.skip?.interpreter && test.skip?.compiler)) {
              it.skip(testName, testFn);
            } else {
              it(testName, testFn);
            }
          });
        });
      });
    });
  });
});
