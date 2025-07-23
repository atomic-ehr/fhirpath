# FHIRPath Test Cases

This directory contains comprehensive test cases for the FHIRPath implementation, organized according to ADR-008.

## Directory Structure

```
test-cases/
├── operations/           # Tests for all operators and functions
│   ├── arithmetic/      # Arithmetic operators (+, -, *, /, div, mod, &)
│   ├── collection/      # Collection operations (union, combine, exclude, intersect)
│   ├── comparison/      # Comparison operators (=, !=, <, >, <=, >=, ~, !~)
│   ├── existence/       # Existence functions (exists, empty, count, etc.)
│   ├── filtering/       # Filtering functions (where, select, ofType, repeat)
│   ├── logical/         # Logical operators (and, or, not, xor, implies)
│   ├── membership/      # Membership operators (in, contains)
│   ├── string/          # String manipulation functions
│   ├── subsetting/      # Subsetting functions (first, last, tail, skip, take, single)
│   ├── type-conversion/ # Type conversion functions (toString, toInteger, etc.)
│   ├── type-operators/  # Type operators (is, as)
│   ├── utility/         # Utility functions (iif, defineVariable, trace, check)
│   └── literals.json    # Tests for literal expressions
├── navigation.json      # Tests for path navigation (e.g., Patient.name.given)
├── variables.json       # Tests for variables ($this, %context, etc.)
├── integration/         # Integration tests with real FHIR resources
├── errors/              # Error handling tests
└── metadata.json        # Test suite metadata and statistics
```

## Test Format

Each test file contains a JSON structure with the following format:

```json
{
  "name": "Test Suite Name",
  "description": "Description of what this suite tests",
  "tests": [
    {
      "name": "test name",
      "expression": "FHIRPath expression",
      "input": {},
      "expected": [],
      "tags": ["category", "operator:+", "difficulty:basic"],
      "specRef": "§6.5.1",  // Optional: reference to spec section
      "error": {            // Optional: for error testing
        "type": "TypeError",
        "message": "regex pattern",
        "phase": "parse|analyze|evaluate"
      }
    }
  ]
}
```

## Running Tests

### Run all tests in a file
```bash
bun tools/testcase.ts operations/arithmetic/plus.json
```

### Run a specific test
```bash
bun tools/testcase.ts operations/arithmetic/plus.json "addition - integers"
```

### Run with specific mode
```bash
bun tools/testcase.ts operations/arithmetic/plus.json "addition - integers" interpreter
```

### Find tests by tag
```bash
bun tools/testcase.ts --tag "operator:+"
bun tools/testcase.ts --tag "difficulty:basic"
```

### Show all failing tests
```bash
bun tools/testcase.ts --failing
```

## Tag System

Tests are tagged for easy discovery:

- **Operation tags**: `operator:+`, `function:where`
- **Category tags**: `arithmetic`, `comparison`, `logical`
- **Difficulty tags**: `difficulty:basic`, `difficulty:intermediate`, `difficulty:advanced`
- **Feature tags**: `navigation`, `three-valued-logic`, `error`

## Adding New Tests

1. Find the appropriate file based on the operation being tested
2. Add your test case following the standard format
3. Include appropriate tags
4. Run the test to ensure it passes
5. If testing a new operation, create a new file in the appropriate directory

## Test Coverage

See `metadata.json` for test coverage statistics and tag definitions.