# Task: Implement --pending Command in testcase.ts

## Problem

The `--pending` command is documented in CLAUDE.md but not actually implemented in `tools/testcase.ts`. When users try to run `bun tools/testcase.ts --pending`, it fails with an error trying to open a file named "--pending".

### Current Behavior
- `bun tools/testcase.ts --pending` fails with ENOENT error
- The command is documented but not implemented

### Expected Behavior
- `bun tools/testcase.ts --pending` should list all pending tests across all test files
- Should show test name, expression, file path, and pending reason

## Implementation Plan

1. Add `--pending` command handling in the main function
2. Scan all test files in test-cases directory
3. Filter tests with `pending` property
4. Display formatted list of pending tests

## Success Criteria

1. ✅ `bun tools/testcase.ts --pending` lists all pending tests
2. ✅ Output includes test name, expression, file, and reason
3. ✅ Command works without errors
4. ✅ Consistent with existing command patterns (like --failing)
5. ✅ Output grouped by file for better readability

## Files Modified

- ✅ `tools/testcase.ts` - Added --pending command implementation with grouped output

## What Was Done

Successfully implemented the `--pending` command in testcase.ts:

1. **Added command handler** that scans all test files for pending tests
2. **Grouped output by file** for better organization and readability
3. **Shows summary** with total pending tests and number of affected files
4. **Displays for each test**:
   - Test name
   - Expression
   - Reason for pending status
   - Command to run that specific test
5. **Consistent formatting** with other commands like --failing