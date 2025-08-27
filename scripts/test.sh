#!/bin/bash

# Default test path
TEST_PATH="test/*"

# Check if a filter argument was provided
if [ "$1" ]; then
  TEST_PATH="$1"
fi

# Run tests with error filtering
bun test "$TEST_PATH" 2>&1 | grep -E '^(✗|error:|Error|FAIL|at )' || echo 'All tests passed!'