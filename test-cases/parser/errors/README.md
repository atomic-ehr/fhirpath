# Parser Error Test Cases

This directory contains test cases for parser error handling and diagnostics.

## Test Files

### syntax-errors.json
Common syntax errors that the parser should detect and report with clear messages.

### multiple-errors.json
Test cases with multiple errors to verify the parser's error recovery capabilities in diagnostic mode.

### error-recovery.json
Specific tests for error recovery mechanisms, ensuring the parser can continue after errors and produce partial ASTs.

### contextual-messages.json
Tests that verify error messages are contextual and helpful based on where the error occurs (function call, index expression, etc.).

### edge-cases.json
Boundary conditions and edge cases like empty expressions, single tokens, deeply nested structures, etc.

## Test Case Structure

Each test case includes:
- `name`: Descriptive test name
- `expression`: The FHIRPath expression to parse
- `tags`: Categories for filtering tests
- `mode` or `modes`: Which parser mode(s) to test (optional)
- `expected`: Expected results including:
  - `error`: Whether an error is expected
  - `diagnostics`: Expected diagnostic messages
  - `diagnosticCount`: Expected number of diagnostics
  - `hasPartialAst`: Whether a partial AST should be created
  - Other mode-specific expectations

## Running Tests

These test cases are designed to be run with the test case runner:

```bash
# Run all error tests
bun tools/testcase.ts parser/errors

# Run specific file
bun tools/testcase.ts parser/errors/syntax-errors.json

# Run tests for specific mode
bun tools/testcase.ts parser/errors --mode diagnostic
```

## Adding New Test Cases

When adding new error test cases:
1. Choose the appropriate file based on the error type
2. Include relevant tags for categorization
3. Specify which parser modes should be tested
4. Document expected diagnostics clearly
5. Consider both the error case and recovery behavior