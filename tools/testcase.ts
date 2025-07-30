#!/usr/bin/env bun

import { runTestFromFile, runAllTestsFromFile, loadTestSuite } from "./lib/test-helpers";
import { join, basename } from "path";
import { readFileSync, readdirSync, statSync, writeFileSync } from "fs";

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  console.log(`
🧪 FHIRPath Test Case Runner

Usage:
  bun tools/testcase.ts <test-file> [test-name]
  bun tools/testcase.ts <test-file> --list
  bun tools/testcase.ts <test-file> --pending
  bun tools/testcase.ts <test-file> --toggle-pending <test-name> [reason]
  bun tools/testcase.ts --tags
  bun tools/testcase.ts --tag <tag-name>
  bun tools/testcase.ts --failing
  bun tools/testcase.ts --pending
  bun tools/testcase.ts --watch

Arguments:
  test-file   Path to JSON test file (relative to test-cases/)
  test-name   Optional: specific test name to run (if not provided, runs all tests)

Commands:
  --list              List all tests in a specific file
  --pending           Show all pending tests (globally or for a specific file)
  --toggle-pending    Toggle pending status on/off for a specific test
  --tags              List all unique tags from all test files
  --tag               Show all test expressions for a specific tag
  --failing           Show all failing tests with commands to debug them
  --watch             Watch for changes in failing tests and re-run them

Examples:
  # Run all tests in a file
  bun tools/testcase.ts operators/arithmetic.json
  
  # Run a specific test
  bun tools/testcase.ts operators/arithmetic.json "addition - integers"
  
  # Run a specific test with details
  bun tools/testcase.ts operators/arithmetic.json "addition - integers"
  
  # List all tests in a file
  bun tools/testcase.ts operators/arithmetic.json --list
  
  # Show pending tests in a specific file
  bun tools/testcase.ts operations/utility/defineVariable.json --pending
  
  # Toggle pending status - disable a test
  bun tools/testcase.ts variables.json --toggle-pending "undefined variable throws error" "Working on implementation"
  
  # Toggle pending status - enable a test
  bun tools/testcase.ts variables.json --toggle-pending "undefined variable throws error"
  
  # List all unique tags
  bun tools/testcase.ts --tags
  
  # Show all expressions with a specific tag
  bun tools/testcase.ts --tag arithmetic
  
  # Show failing tests
  bun tools/testcase.ts --failing
  
  # Show all pending tests globally
  bun tools/testcase.ts --pending
  
  # Watch failing tests
  bun tools/testcase.ts --watch
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
        // Skip tests that are marked as skip, pending, or parser-only
        if ((test.skip?.interpreter && test.skip?.compiler) || test.pending || test.parserOnly) {
          return;
        }

        // Run the test silently by temporarily redirecting console
        const originalLog = console.log;
        const originalError = console.error;
        console.log = () => {};
        console.error = () => {};

        const result = runSingleTest(test);

        // Restore console
        console.log = originalLog;
        console.error = originalError;

        const testFailed = result &&
          !result.pending &&
          (!result.success && !result.expectedError) ||
          (result.value !== undefined && JSON.stringify(result.value) !== JSON.stringify(test.expected));

        if (testFailed) {
          const relativePath = file.replace(testCasesDir + "/", "");

          let error = "";
          if (result && !result.success) {
            error = result.error || "Results don't match expected";
          }

          failingTests.push({
            suite: suite.name || basename(file),
            test: test.name,
            expression: test.expression,
            file: relativePath,
            error,
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
        console.log(`${index + 1}. ${test.test}`);
        console.log(`   Expression: ${test.expression}`);
        if (test.error) {
          console.log(`   Error: ${test.error}`);
        }
        console.log(`   Run: bun tools/testcase.ts ${test.file} "${test.test}"`);
        console.log("");
      });

    }
  }

  process.exit(failingTests.length > 0 ? 1 : 0);
}

// Handle --pending command
if (args[0] === "--pending") {
  const testCasesDir = join(__dirname, "../test-cases");
  const pendingTests: Array<{
    suite: string;
    test: string;
    expression: string;
    file: string;
    reason?: string;
  }> = [];

  console.log("\n⏳ Finding all pending tests...\n");

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

  // Search for pending tests
  jsonFiles.forEach(file => {
    try {
      const content = readFileSync(file, "utf-8");
      const suite = JSON.parse(content);

      if (suite.tests && Array.isArray(suite.tests)) {
        suite.tests.forEach((test: any) => {
          if (test.pending) {
            const relativePath = file.replace(testCasesDir + "/", "");
            pendingTests.push({
              suite: suite.name || basename(file),
              test: test.name,
              expression: test.expression,
              file: relativePath,
              reason: typeof test.pending === 'string' ? test.pending : undefined
            });
          }
        });
      }
    } catch (error) {
      // Skip files that can't be parsed
    }
  });

  // Display results
  console.log(`⏳ Pending Tests\n`);

  if (pendingTests.length === 0) {
    console.log("✅ No pending tests found!");
  } else {
    console.log(`Found ${pendingTests.length} pending tests:\n`);

    // Group by file
    const byFile = new Map<string, typeof pendingTests>();
    pendingTests.forEach(test => {
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
          console.log(`   ${index + 1}. ${test.test}`);
          console.log(`      Expression: ${test.expression}`);
          if (test.reason) {
            console.log(`      Reason: ${test.reason}`);
          }
          console.log(`      Run: bun tools/testcase.ts ${file} "${test.test}"`);
        });
        console.log("");
      });
  }

  process.exit(0);
}

// Handle --watch command
if (args[0] === "--watch") {
  const testCasesDir = join(__dirname, "../test-cases");
  const { watch } = require("fs");

  console.log("\n👁️  Watch Mode - Monitoring failing tests...\n");
  console.log("Press Ctrl+C to exit\n");

  // Import test helpers at module level
  const { runSingleTest } = require("./lib/test-helpers");

  // Function to find all failing tests
  function findFailingTests(): Array<{
    suite: string;
    test: string;
    expression: string;
    file: string;
    fullPath: string;
  }> {
    const failingTests: Array<{
      suite: string;
      test: string;
      expression: string;
      file: string;
      fullPath: string;
      interpreterFailed: boolean;
      compilerFailed: boolean;
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

    // Check each test
    jsonFiles.forEach(file => {
      try {
        const suite = loadTestSuite(file);

        suite.tests.forEach((test: any) => {
          // Skip tests that are marked as skip or pending
          if ((test.skip?.interpreter && test.skip?.compiler) || test.pending) {
            return;
          }

          // Run the test silently
          const originalLog = console.log;
          const originalError = console.error;
          console.log = () => {};
          console.error = () => {};

          const result = runSingleTest(test);

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

            failingTests.push({
              suite: suite.name || basename(file),
              test: test.name,
              expression: test.expression,
              file: relativePath,
              fullPath: file,
              interpreterFailed,
              compilerFailed
            });
          }
        });
      } catch (error) {
        // Skip files that can't be parsed
      }
    });

    return failingTests;
  }

  // Run failing tests
  function runFailingTests() {
    console.clear();
    console.log("\n👁️  Watch Mode - Re-running failing tests...\n");

    const failingTests = findFailingTests();

    if (failingTests.length === 0) {
      console.log("✅ All tests are passing!");
      return;
    }

    console.log(`Found ${failingTests.length} failing tests\n`);

    // Group by file for better output
    const byFile = new Map<string, typeof failingTests>();
    failingTests.forEach(test => {
      if (!byFile.has(test.file)) {
        byFile.set(test.file, []);
      }
      byFile.get(test.file)!.push(test);
    });

    // Run tests file by file
    Array.from(byFile.entries()).forEach(([file, tests]) => {
      console.log(`\n📄 ${file}:`);

      tests.forEach(test => {
        // Run the test with output
        console.log(`\n🧪 ${test.test}`);
        try {
          runTestFromFile(test.fullPath, test.test);
        } catch (error: any) {
          console.error(`❌ Error: ${error.message}`);
        }
      });
    });

    console.log("\n⏳ Watching for changes...");
  }

  // Initial run
  runFailingTests();

  // Watch for changes
  const watchers: any[] = [];

  // Watch test case files
  watchers.push(watch(testCasesDir, { recursive: true }, (_eventType: string, filename: string) => {
    if (filename && filename.endsWith('.json')) {
      console.log(`\n🔄 Detected change in ${filename}`);
      setTimeout(runFailingTests, 100); // Small delay to ensure file write is complete
    }
  }));

  // Watch source files
  const srcDir = join(__dirname, "../src");
  watchers.push(watch(srcDir, { recursive: true }, (_eventType: string, filename: string) => {
    if (filename && (filename.endsWith('.ts') || filename.endsWith('.js'))) {
      console.log(`\n🔄 Detected change in ${filename}`);
      setTimeout(runFailingTests, 100);
    }
  }));

  // Handle cleanup
  process.on('SIGINT', () => {
    console.log('\n\n👋 Exiting watch mode...');
    watchers.forEach(watcher => watcher.close());
    process.exit(0);
  });

  // Keep the process running
  process.stdin.resume();
}

const testFile = args[0];
const testName = args[1];

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

// Check if listing pending tests for a specific file
if (testName === "--pending") {
  try {
    const suite = loadTestSuite(testPath);
    const pendingTests = suite.tests.filter((test: any) => test.pending);
    
    console.log(`\n⏳ Pending Tests in: ${suite.name}`);
    if (suite.description) {
      console.log(`   ${suite.description}`);
    }
    
    if (pendingTests.length === 0) {
      console.log("\n✅ No pending tests in this file!");
    } else {
      console.log(`\n📊 Pending tests: ${pendingTests.length}`);
      console.log("\n🧪 Tests:");
      
      pendingTests.forEach((test: any, index: number) => {
        console.log(`\n${index + 1}. ${test.name}`);
        console.log(`   Expression: ${test.expression}`);
        if (typeof test.pending === 'string') {
          console.log(`   ⏸️  Reason: ${test.pending}`);
        }
        const tags = test.tags ? ` [${test.tags.join(", ")}]` : "";
        if (tags) {
          console.log(`   Tags: ${tags}`);
        }
        console.log(`   Run: bun tools/testcase.ts ${basename(testPath)} "${test.name}"`);
      });
    }
  } catch (error: any) {
    console.error(`❌ Error loading test file: ${error.message}`);
    process.exit(1);
  }
  process.exit(0);
}

// Check if toggling pending status for a specific test
if (testName === "--toggle-pending" && args[2]) {
  const targetTestName = args[2];
  const reason = args[3] || "Pending implementation";
  
  try {
    const file = Bun.file(testPath);
    const content = await file.text();
    const suite = JSON.parse(content);
    
    // Find the test
    const testIndex = suite.tests.findIndex((test: any) => test.name === targetTestName);
    
    if (testIndex === -1) {
      console.error(`❌ Test "${targetTestName}" not found in ${basename(testPath)}`);
      process.exit(1);
    }
    
    const test = suite.tests[testIndex];
    
    // Toggle pending status
    if (test.pending) {
      // Remove pending
      delete test.pending;
      console.log(`\n✅ Enabled test: ${targetTestName}`);
      console.log(`   Test is now active and will run normally`);
    } else {
      // Add pending
      test.pending = reason;
      console.log(`\n⏸️  Disabled test: ${targetTestName}`);
      console.log(`   Reason: ${reason}`);
    }
    
    // Write back to file with proper formatting using Bun
    const updatedContent = JSON.stringify(suite, null, 2) + '\n';
    await Bun.write(testPath, updatedContent);
    
    console.log(`\n📝 Updated: ${basename(testPath)}`);
    
    // Show the test details
    console.log(`\n📊 Test details:`);
    console.log(`   Expression: ${test.expression}`);
    if (test.tags) {
      console.log(`   Tags: [${test.tags.join(", ")}]`);
    }
    
  } catch (error: any) {
    console.error(`❌ Error updating test file: ${error.message}`);
    process.exit(1);
  }
  process.exit(0);
}

// Run the tests (skip if we've already handled special commands)
if (args[0] !== "--watch" && args[0] !== "--tags" && args[0] !== "--tag" && args[0] !== "--failing" && args[0] !== "--failing-commands" && args[0] !== "--pending") {
  try {
    if (testName && testName !== "--list") {
      // Run specific test
      console.log(`\n🎯 Running test from: ${basename(testPath!)}`);
      runTestFromFile(testPath!, testName);
    } else {
      // Run all tests in the file
      console.log(`\n🎯 Running all tests from: ${basename(testPath)}`);
      runAllTestsFromFile(testPath!);
    }
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}
