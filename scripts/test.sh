#!/bin/bash

# Default test path - explicitly target .test.ts files
TEST_PATH="test"

# Check if a filter argument was provided
if [ "$1" ]; then
  TEST_PATH="$1"
fi

# Run tests and filter output by removing:
# - Successful test lines starting with (pass) or ✓
# - Test file name headers (e.g., "test/foo.test.ts:")
# - Empty lines
# Everything else is shown (errors, failures, summaries, stack traces, etc.)
bun test "$TEST_PATH" 2>&1 | grep -v '^(pass)' | grep -v '^✓' | grep -v '^test/.*\.test\.ts:$' | grep -v '^$'

# Check exit status of bun test (from PIPESTATUS array)
EXIT_CODE=${PIPESTATUS[0]}

# If no failures, indicate success
if [ $EXIT_CODE -eq 0 ]; then
  echo "All tests passed!"
fi

exit $EXIT_CODE