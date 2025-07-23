#!/usr/bin/env bun

import { runTestFromFile, runAllTestsFromFile, loadTestSuite } from "./lib/test-helpers";
import { join, basename } from "path";
import { readFileSync, readdirSync, statSync } from "fs";

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  console.log(`
🧪 FHIRPath Test Case Runner

Usage:
  bun tools/testcase.ts <test-file> [test-name] [mode]
  bun tools/testcase.ts --tags
  bun tools/testcase.ts --tag <tag-name>
  bun tools/testcase.ts --failing

Arguments:
  test-file   Path to JSON test file (relative to test-cases/)
  test-name   Optional: specific test name to run (if not provided, runs all tests)
  mode        Optional: 'interpreter' | 'compiler' | 'both' (default: 'both')

Commands:
  --tags      List all unique tags from all test files
  --tag       Show all test expressions for a specific tag
  --failing   Show all failing tests with commands to debug them

Examples:
  # Run all tests in a file
  bun tools/testcase.ts operators/arithmetic.json
  
  # Run a specific test
  bun tools/testcase.ts operators/arithmetic.json "addition - integers"
  
  # Run with interpreter only
  bun tools/testcase.ts operators/arithmetic.json "addition - integers" interpreter
  
  # List all tests in a file
  bun tools/testcase.ts operators/arithmetic.json --list
  
  # List all unique tags
  bun tools/testcase.ts --tags
  
  # Show all expressions with a specific tag
  bun tools/testcase.ts --tag arithmetic
  
  # Show failing tests
  bun tools/testcase.ts --failing
`);
  process.exit(0);
}

// Handle --tags command
if (args[0] === "--tags") {
  const testCasesDir = join(__dirname, "../test-cases");
  const allTags = new Set<string>();
  const tagCounts = new Map<string, number>();
  
  // Function to recursively find all JSON files
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
  
  // Find all test files
  const jsonFiles = findJsonFiles(testCasesDir);
  
  // Extract tags from each file
  jsonFiles.forEach(file => {
    try {
      const content = readFileSync(file, "utf-8");
      const suite = JSON.parse(content);
      
      if (suite.tests && Array.isArray(suite.tests)) {
        suite.tests.forEach((test: any) => {
          if (test.tags && Array.isArray(test.tags)) {
            test.tags.forEach((tag: string) => {
              allTags.add(tag);
              tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            });
          }
        });
      }
    } catch (error) {
      // Skip files that can't be parsed
    }
  });
  
  // Sort tags alphabetically
  const sortedTags = Array.from(allTags).sort();
  
  console.log(`\n🏷️  Unique Tags in Test Cases\n`);
  console.log(`Total unique tags: ${sortedTags.length}\n`);
  
  // Group tags by category (if they have prefixes)
  const categorizedTags = new Map<string, string[]>();
  const uncategorized: string[] = [];
  
  sortedTags.forEach(tag => {
    if (tag.includes("-")) {
      const category = tag.split("-")[0]!;
      if (!categorizedTags.has(category)) {
        categorizedTags.set(category!, []);
      }
      categorizedTags.get(category!)!.push(tag);
    } else {
      uncategorized.push(tag);
    }
  });
  
  // Display categorized tags
  if (uncategorized.length > 0) {
    console.log("General tags:");
    uncategorized.forEach(tag => {
      console.log(`  • ${tag} (${tagCounts.get(tag)} tests)`);
    });
    console.log("");
  }
  
  // Display tags by category
  Array.from(categorizedTags.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([category, tags]) => {
      console.log(`${category.charAt(0).toUpperCase() + category.slice(1)} tags:`);
      tags.forEach(tag => {
        console.log(`  • ${tag} (${tagCounts.get(tag)} tests)`);
      });
      console.log("");
    });
  
  process.exit(0);
}

// Handle --tag command
if (args[0] === "--tag") {
  if (!args[1]) {
    console.error("❌ Please provide a tag name");
    console.log("Example: bun tools/testcase.ts --tag arithmetic");
    process.exit(1);
  }
  
  const searchTag = args[1];
  const testCasesDir = join(__dirname, "../test-cases");
  const matchingTests: Array<{
    suite: string;
    test: string;
    expression: string;
    file: string;
  }> = [];
  
  // Function to recursively find all JSON files
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
  
  // Find all test files
  const jsonFiles = findJsonFiles(testCasesDir);
  
  // Search for tests with the specified tag
  jsonFiles.forEach(file => {
    try {
      const content = readFileSync(file, "utf-8");
      const suite = JSON.parse(content);
      
      if (suite.tests && Array.isArray(suite.tests)) {
        suite.tests.forEach((test: any) => {
          if (test.tags && Array.isArray(test.tags) && test.tags.includes(searchTag)) {
            const relativePath = file.replace(testCasesDir + "/", "");
            matchingTests.push({
              suite: suite.name || basename(file),
              test: test.name,
              expression: test.expression,
              file: relativePath
            });
          }
        });
      }
    } catch (error) {
      // Skip files that can't be parsed
    }
  });
  
  // Display results
  console.log(`\n🏷️  Tests with tag: "${searchTag}"\n`);
  
  if (matchingTests.length === 0) {
    console.log(`No tests found with tag "${searchTag}"`);
  } else {
    console.log(`Found ${matchingTests.length} tests:\n`);
    
    // Group by file
    const byFile = new Map<string, typeof matchingTests>();
    matchingTests.forEach(test => {
      if (!byFile.has(test.file)) {
        byFile.set(test.file, []);
      }
      byFile.get(test.file)!.push(test);
    });
    
    // Display grouped by file
    Array.from(byFile.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([file, tests]) => {
        console.log(`📄 ${file}:`);
        tests.forEach((test, index) => {
          console.log(`   ${index + 1}. ${test.test} → ${test.expression}`);
        });
        console.log("");
      });
  }
  
  process.exit(0);
}

// Handle --failing command
if (args[0] === "--failing" || args[0] === "--failing-commands") {
  const commandsOnly = args[0] === "--failing-commands";
  const testCasesDir = join(__dirname, "../test-cases");
  const failingTests: Array<{
    suite: string;
    test: string;
    expression: string;
    file: string;
    error?: string;
    interpreterFailed: boolean;
    compilerFailed: boolean;
  }> = [];
  
  if (!commandsOnly) {
    console.log("\n🔍 Checking all tests for failures...\n");
  }
  
  // Import test helpers
  const { loadTestSuite, runSingleTest } = require("./lib/test-helpers");
  
  // Function to recursively find all JSON files
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
  
  // Find all test files
  const jsonFiles = findJsonFiles(testCasesDir);
  
  // Check each test
  jsonFiles.forEach(file => {
    try {
      const suite = loadTestSuite(file);
      
      suite.tests.forEach((test: any) => {
        // Skip tests that are marked as skip or pending
        if ((test.skip?.interpreter && test.skip?.compiler) || test.pending) {
          return;
        }
        
        // Run the test silently by temporarily redirecting console
        const originalLog = console.log;
        const originalError = console.error;
        console.log = () => {};
        console.error = () => {};
        
        const result = runSingleTest(test, 'both');
        
        // Restore console
        console.log = originalLog;
        console.error = originalError;
        
        const interpreterFailed = result.interpreter && 
          !result.interpreter.pending &&
          (!result.interpreter.success && !result.interpreter.expectedError) || 
          (result.interpreter.value !== undefined && JSON.stringify(result.interpreter.value) !== JSON.stringify(test.expected));
        const compilerFailed = result.compiler && 
          !result.compiler.pending &&
          (!result.compiler.success && !result.compiler.expectedError) || 
          (result.compiler.value !== undefined && JSON.stringify(result.compiler.value) !== JSON.stringify(test.expected));
        
        if (interpreterFailed || compilerFailed) {
          const relativePath = file.replace(testCasesDir + "/", "");
          
          let error = "";
          if (result.interpreter && !result.interpreter.success) {
            error = `Interpreter: ${result.interpreter.error}`;
          } else if (result.compiler && !result.compiler.success) {
            error = `Compiler: ${result.compiler.error}`;
          } else if (interpreterFailed && compilerFailed) {
            error = "Results don't match expected";
          }
          
          failingTests.push({
            suite: suite.name || basename(file),
            test: test.name,
            expression: test.expression,
            file: relativePath,
            error,
            interpreterFailed,
            compilerFailed
          });
        }
      });
    } catch (error) {
      // Skip files that can't be parsed
    }
  });
  
  // Display results
  if (commandsOnly) {
    // Just output the commands for easy scripting
    if (failingTests.length === 0) {
      // No output for no failures in commands-only mode
    } else {
      failingTests.forEach(test => {
        console.log(`bun tools/testcase.ts ${test.file} "${test.test}"`);
      });
    }
  } else {
    console.log(`\n❌ Failing Tests\n`);
    
    if (failingTests.length === 0) {
      console.log("✅ All tests are passing!");
    } else {
      console.log(`Found ${failingTests.length} failing tests:\n`);
      
      // Display all tests with their debug commands
      failingTests.forEach((test, index) => {
        const failureInfo = [];
        if (test.interpreterFailed) failureInfo.push("I");
        if (test.compilerFailed) failureInfo.push("C");
        const failureMarker = `[${failureInfo.join("/")}]`;
        
        console.log(`${index + 1}. ${test.test} ${failureMarker}`);
        console.log(`   Expression: ${test.expression}`);
        if (test.error) {
          console.log(`   Error: ${test.error}`);
        }
        console.log(`   Run: bun tools/testcase.ts ${test.file} "${test.test}"`);
        console.log("");
      });
      
      console.log("💡 Legend: [I] = Interpreter failed, [C] = Compiler failed, [I/C] = Both failed");
    }
  }
  
  process.exit(failingTests.length > 0 ? 1 : 0);
}

const testFile = args[0];
const testName = args[1];
const mode = args[2] as "interpreter" | "compiler" | "both" | undefined;

// Check if testFile is provided
if (!testFile) {
  console.error("Test file is required");
  process.exit(1);
}

// Build the full path
const testPath = testFile.startsWith("/") || testFile.startsWith("../") 
  ? testFile 
  : join(__dirname, "../test-cases", testFile);

// Check if listing tests
if (testName === "--list") {
  try {
    const suite = loadTestSuite(testPath);
    console.log(`\n📋 Test Suite: ${suite.name}`);
    if (suite.description) {
      console.log(`   ${suite.description}`);
    }
    console.log(`\n📊 Total tests: ${suite.tests.length}`);
    console.log("\n🧪 Tests:");
    
    suite.tests.forEach((test, index) => {
      const status = test.skip ? " (skipped)" : "";
      const tags = test.tags ? ` [${test.tags.join(", ")}]` : "";
      console.log(`   ${index + 1}. ${test.name}${status}${tags}`);
      console.log(`      Expression: ${test.expression}`);
    });
  } catch (error: any) {
    console.error(`❌ Error loading test file: ${error.message}`);
    process.exit(1);
  }
  process.exit(0);
}

// Run the tests
try {
  if (testName && testName !== "--list") {
    // Run specific test
    console.log(`\n🎯 Running test from: ${basename(testPath!)}`);
    runTestFromFile(testPath!, testName, mode || "both");
  } else {
    // Run all tests in the file
    console.log(`\n🎯 Running all tests from: ${basename(testPath)}`);
    runAllTestsFromFile(testPath!, mode || "both");
  }
} catch (error: any) {
  console.error(`\n❌ Error: ${error.message}`);
  process.exit(1);
}