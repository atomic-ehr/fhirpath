# ADR-008: Test Cases Organization

## Status

Proposed

## Context

The current test cases organization in the `test-cases/` directory has several issues that make it difficult to maintain and discover tests:

1. **Inconsistent test format**: Some test files use "name" field while others use "description" for test names
2. **Misplaced files**: `three-valued-logic.json` is at the root level but logically belongs with operators
3. **No categorization for special cases**: All tests are mixed together without clear separation of basic tests, edge cases, or error scenarios
4. **Missing metadata**: Tests lack important metadata like:
   - References to FHIRPath specification sections
   - Difficulty levels (basic/intermediate/advanced)
   - Compliance markers (spec-compliant vs extensions)
5. **Incomplete tagging**: Current tags don't include specific operation names (e.g., "+", "where", "select"), making it hard to find all tests for a specific operation

## Decision

Reorganize the test cases with the following structure and standards:

### 1. Standardized Test Format

All test files will use a consistent JSON structure:
```json
{
  "name": "Test Suite Name",
  "description": "Brief description of what this suite tests",
  "tests": [
    {
      "name": "test name",
      "expression": "FHIRPath expression",
      "input": {},
      "expected": [],
      "tags": ["category", "operator:+", "difficulty:basic"],
      "specRef": "§6.5.1",  // Optional: reference to spec section
      "error": {              // Optional: for error testing
        "type": "TypeError",  // Error type: TypeError, EvaluationError, etc.
        "message": "regex",   // Regex pattern to match error message
        "phase": "parse"      // When error occurs: parse, analyze, evaluate
      }
    }
  ]
}
```

### 2. Enhanced Tagging System

Tags will include:
- **Category tags**: "operator", "function", "navigation", "literal", "variable"
- **Feature tags**: "arithmetic", "comparison", "logical", "filter", etc.
- **Operation tags**: Specific operation names prefixed with their type:
  - Operators: "operator:+", "operator:=", "operator:and"
  - Functions: "function:where", "function:select", "function:empty"
- **Difficulty tags**: "difficulty:basic", "difficulty:intermediate", "difficulty:advanced"
- **Compliance tags**: "spec-compliant", "extension"

### 3. Directory Structure and Naming Convention

Test files should mirror the exact structure of `src/registry/operations/`:
- Each operation category becomes a directory (arithmetic/, comparison/, etc.)
- Each individual operation gets its own test file within the category
- File names match the operation name (plus.json for + operator, where.json for where() function)
- Additional test-specific directories for complex scenarios

```
test-cases/
├── README.md                    # Explains organization and conventions
├── metadata.json               # Suite-wide metadata and statistics
├── operations/                 # Mirrors src/registry/operations/
│   ├── arithmetic/
│   │   ├── plus.json          # Tests for + operator
│   │   ├── minus.json         # Tests for - operator
│   │   ├── multiply.json      # Tests for * operator
│   │   ├── divide.json        # Tests for / operator
│   │   ├── div.json           # Tests for div operator
│   │   ├── mod.json           # Tests for mod operator
│   │   └── concat.json        # Tests for & operator
│   ├── collection/
│   │   ├── combine.json       # Tests for combine function
│   │   ├── exclude.json       # Tests for exclude function
│   │   ├── intersect.json     # Tests for intersect function
│   │   └── union.json         # Tests for | operator
│   ├── comparison/
│   │   ├── eq.json            # Tests for = operator
│   │   ├── neq.json           # Tests for != operator
│   │   ├── lt.json            # Tests for < operator
│   │   ├── gt.json            # Tests for > operator
│   │   ├── lte.json           # Tests for <= operator
│   │   ├── gte.json           # Tests for >= operator
│   │   ├── equiv.json         # Tests for ~ operator
│   │   └── nequiv.json        # Tests for !~ operator
│   ├── existence/
│   │   ├── exists.json        # Tests for exists() function
│   │   ├── empty.json         # Tests for empty() function
│   │   ├── count.json         # Tests for count() function
│   │   ├── first.json         # Tests for first() function
│   │   ├── last.json          # Tests for last() function
│   │   ├── single.json        # Tests for single() function
│   │   ├── all.json           # Tests for all() function
│   │   ├── allTrue.json       # Tests for allTrue() function
│   │   ├── anyTrue.json       # Tests for anyTrue() function
│   │   ├── allFalse.json      # Tests for allFalse() function
│   │   ├── anyFalse.json      # Tests for anyFalse() function
│   │   ├── distinct.json      # Tests for distinct() function
│   │   └── isDistinct.json    # Tests for isDistinct() function
│   ├── filtering/
│   │   ├── where.json         # Tests for where() function
│   │   ├── select.json        # Tests for select() function
│   │   ├── ofType.json        # Tests for ofType() function
│   │   └── repeat.json        # Tests for repeat() function
│   ├── literals.json          # Tests for literal expressions
│   ├── logical/
│   │   ├── and.json           # Tests for and operator
│   │   ├── or.json            # Tests for or operator
│   │   ├── not.json           # Tests for not() function
│   │   ├── xor.json           # Tests for xor operator
│   │   └── implies.json       # Tests for implies operator
│   ├── math/                  # Mathematical functions
│   ├── membership/
│   │   ├── in.json            # Tests for in operator
│   │   └── contains.json      # Tests for contains operator
│   ├── string/                # String manipulation functions
│   ├── subsetting/
│   │   ├── tail.json          # Tests for tail() function
│   │   ├── skip.json          # Tests for skip() function
│   │   └── take.json          # Tests for take() function
│   ├── type-checking.json     # Tests for type checking operations
│   ├── type-conversion/
│   │   ├── toString.json      # Tests for toString() function
│   │   ├── toInteger.json     # Tests for toInteger() function
│   │   ├── toDecimal.json     # Tests for toDecimal() function
│   │   └── toBoolean.json     # Tests for toBoolean() function
│   ├── type-operators/
│   │   ├── is.json            # Tests for is operator
│   │   └── as.json            # Tests for as operator
│   └── utility/
│       ├── iif.json           # Tests for iif() function
│       ├── defineVariable.json # Tests for defineVariable() function
│       ├── trace.json         # Tests for trace() function
│       └── check.json         # Tests for check() function
├── navigation.json             # Tests for path navigation (Patient.name.given)
├── variables.json              # Tests for $this, %context, etc.
├── integration/               # Integration tests with real FHIR resources
│   ├── patient-queries.json   # Common Patient resource queries
│   ├── observation-queries.json # Common Observation queries
│   ├── bundle-navigation.json # Bundle navigation scenarios
│   └── search-parameters.json # FHIR search parameter expressions
└── errors/                    # Error handling tests
    ├── parse-errors.json     # Syntax errors
    ├── type-errors.json      # Type checking errors
    └── evaluation-errors.json # Runtime errors
```

### 4. Integration Tests

Integration tests use real FHIR resource examples to test common real-world scenarios:

```json
{
  "name": "Get all active medication statements",
  "expression": "MedicationStatement.where(status = 'active')",
  "input": { /* Real FHIR Bundle or Resource */ },
  "expected": [ /* Expected results */ ],
  "tags": ["integration", "medication", "real-world"],
  "description": "Tests filtering medication statements by status in a real patient bundle"
}
```

Integration tests should:
- Use realistic FHIR resource examples
- Test common clinical queries
- Cover FHIR-specific navigation patterns
- Include search parameter expressions used in FHIR servers

### 5. Error Testing

Tests can specify expected errors with structured error information:

```json
{
  "name": "single() with multiple items should fail",
  "expression": "single()",
  "input": [1, 2, 3],
  "error": {
    "type": "EvaluationError",
    "message": "single\\(\\) can only be used on collections with 0 or 1 item",
    "phase": "evaluate"
  },
  "tags": ["function:single", "error", "difficulty:basic"]
}
```

Error types:
- **ParseError**: Syntax errors during parsing
- **TypeError**: Type mismatches during analysis
- **EvaluationError**: Runtime evaluation errors
- **ArgumentError**: Invalid function arguments

Error phases:
- **parse**: Error occurs during expression parsing
- **analyze**: Error occurs during type analysis
- **evaluate**: Error occurs during runtime evaluation

### 5. Test Suite Metadata

Create `test-cases/metadata.json`:
```json
{
  "version": "1.0.0",
  "specVersion": "2.0.0",
  "lastUpdated": "2024-01-01",
  "statistics": {
    "totalTests": 500,
    "byCategory": {},
    "byTag": {},
    "coverage": {}
  },
  "tagDefinitions": {
    "operator:+": "Addition operator",
    "function:where": "Where filtering function"
  }
}
```

## Consequences

### Positive

- **Better discoverability**: Developers can easily find tests for specific operations using tags
- **Clearer organization**: Logical grouping makes navigation intuitive
- **Improved tooling**: The testcase tool can filter by operation names (e.g., `--tag "operator:+"`)
- **Specification alignment**: Tests can be traced back to specification sections
- **Progressive learning**: Difficulty levels help newcomers start with basic tests
- **Comprehensive coverage tracking**: Metadata file provides overview of test coverage

### Negative

- **Migration effort**: Existing tests need to be updated to new format
- **More complex structure**: More directories to navigate
- **Maintenance overhead**: Need to maintain metadata.json and ensure consistency
- **Breaking change**: Tools depending on current structure need updates

## Alternatives Considered

1. **Keep flat structure with only tags**
   - Rejected: As test suite grows, a flat structure becomes unwieldy
   - Tags alone don't provide intuitive navigation for new contributors

2. **Organize by specification version**
   - Rejected: Most tests apply across multiple spec versions
   - Would lead to duplication

3. **Separate repositories for different test types**
   - Rejected: Increases complexity of running full test suite
   - Makes it harder to ensure consistency

4. **Use test names as operation indicators**
   - Rejected: Makes it hard to find all tests for an operation programmatically
   - Tags provide better filtering capabilities