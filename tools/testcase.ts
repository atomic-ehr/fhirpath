#!/usr/bin/env bun

import { runAndValidateTest, loadTestSuite, findTest } from "./lib/test-helpers";
import { join, basename } from "path";
import { readFileSync, readdirSync, statSync } from "fs";
import type { TestResult, UnifiedTest } from "./lib/test-helpers";

// Helper to display a single test result
function displayResult(test: UnifiedTest, result: TestResult) {
  if (result.pending) {
    console.log(`   ⏸️  PENDING: ${result.reason}`);
    return;
  }
  if (result.skipped) {
    console.log(`   ⏭️  SKIPPED: ${result.reason}`);
    return;
  }

  console.log(`   Expression: ${test.expression}`);
  if (test.error) {
    console.log(`   Expected Error: /${test.error.message}/`);
  } else {
    console.log(`   Expected: ${JSON.stringify(test.expected)}`);
  }

  console.log(`\n📊 Result:`);
  if (result.success) {
    if (result.expectedError) {
      console.log(`   ✅ Got expected error: ${result.error?.message}`);
    } else {
      console.log(`   ✅ Result: ${JSON.stringify(result.value)}`);
      console.log(`   ✅ Matches expected`);
    }
  } else {
    if (test.error) {
      console.log(`   ❌ Expected error but got result: ${JSON.stringify(result.value)}`);
    } else {
      console.log(`   ❌ Got: ${JSON.stringify(result.value)}`);
      console.log(`   ❌ Does not match expected`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error.message}`);
    }
  }
  console.log(`   ⏱️  Time: ${result.time?.toFixed(2)}ms`);
}

// Main CLI logic
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(`... help text ...`); // Help text omitted for brevity
    return;
  }

  // --- --failing command ---
  if (args[0] === "--failing") {
    console.log("\n🔍 Checking all tests for failures...\n");
    const testCasesDir = join(__dirname, "../test-cases");
    const failingTests: Array<{ test: UnifiedTest, file: string }> = [];

    const testFiles = readdirSync(testCasesDir, { recursive: true }) as string[];

    for (const file of testFiles) {
      if (!file.endsWith(".json") || file.endsWith("metadata.json")) continue;
      
      const fullPath = join(testCasesDir, file);
      if (statSync(fullPath).isDirectory()) continue;

      try {
        const suite = loadTestSuite(fullPath);
        for (const test of suite.tests) {
          const result = await runAndValidateTest(test);
          if (!result.success && !result.pending && !result.skipped) {
            failingTests.push({ test, file });
          }
        }
      } catch (e) { /* ignore parse errors */ }
    }

    if (failingTests.length === 0) {
      console.log("✅ All tests are passing!");
    } else {
      console.log(`\n❌ Found ${failingTests.length} failing tests:\n`);
      failingTests.forEach(({ test, file }, index) => {
        console.log(`${index + 1}. ${test.name}`);
        console.log(`   Expression: ${test.expression}`);
        console.log(`   Run: bun tools/testcase.ts ${file} "${test.name}"`);
        console.log("");
      });
    }
    process.exit(failingTests.length > 0 ? 1 : 0);
  }

  // --- Run single test or all tests in a file ---
  const testFile = args[0];
  const testName = args[1];

  if (!testFile) {
    console.error("Test file is required");
    process.exit(1);
  }

  const testPath = testFile.startsWith("/") || testFile.startsWith("../")
    ? testFile
    : join(__dirname, "../test-cases", testFile);

  try {
    const suite = loadTestSuite(testPath);
    if (testName) {
      // Run specific test
      const test = findTest(suite, testName);
      if (!test) {
        console.error(`❌ Test "${testName}" not found in ${basename(testPath)}`);
        process.exit(1);
      }
      console.log(`\n🎯 Running test: ${test.name}`);
      const result = await runAndValidateTest(test);
      displayResult(test, result);
    } else {
      // Run all tests in the file
      console.log(`\n🎯 Running all tests from: ${basename(testPath)}`);
      for (const test of suite.tests) {
        console.log(`\n--- Test: ${test.name} ---`);
        const result = await runAndValidateTest(test);
        displayResult(test, result);
      }
    }
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();