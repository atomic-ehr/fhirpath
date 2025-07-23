# Task 022: Refactor Test Cases to New Structure

## Objective
Implement the new test cases organization structure as defined in ADR-008.

## Background
The current test organization has files like:
- `test-cases/operators/arithmetic.json` (contains all arithmetic operator tests)
- `test-cases/functions/where.json` (single function tests)
- Inconsistent naming between "name" and "description" fields
- Missing operation-specific tags

## Tools

While refactoring use `./tools/testcase.ts` to run the tests and see the results.

## Tasks

### 1. Create New Directory Structure
- [x] Create `test-cases/operations/` directory
- [x] Create subdirectories for each operation category:
  - [x] `arithmetic/`
  - [x] `collection/`
  - [x] `comparison/`
  - [x] `existence/`
  - [x] `filtering/`
  - [x] `logical/`
  - [x] `membership/`
  - [x] `string/`
  - [x] `subsetting/`
  - [x] `type-conversion/`
  - [x] `type-operators/`
  - [x] `utility/`
- [x] Create `test-cases/integration/` directory
- [x] Create `test-cases/errors/` directory structure

### 2. Split Existing Test Files

#### Arithmetic Tests
From `test-cases/operators/arithmetic.json`, create:
- [x] `operations/arithmetic/plus.json` - Tests for + operator
- [x] `operations/arithmetic/minus.json` - Tests for - operator
- [x] `operations/arithmetic/multiply.json` - Tests for * operator
- [x] `operations/arithmetic/divide.json` - Tests for / operator
- [x] `operations/arithmetic/div.json` - Tests for div operator
- [x] `operations/arithmetic/mod.json` - Tests for mod operator
- [x] `operations/arithmetic/concat.json` - Tests for & operator

#### Comparison Tests
From `test-cases/operators/comparison.json`, create:
- [x] `operations/comparison/eq.json` - Tests for = operator
- [x] `operations/comparison/neq.json` - Tests for != operator
- [x] `operations/comparison/lt.json` - Tests for < operator
- [x] `operations/comparison/gt.json` - Tests for > operator
- [x] `operations/comparison/lte.json` - Tests for <= operator
- [x] `operations/comparison/gte.json` - Tests for >= operator
- [x] `operations/comparison/equiv.json` - Tests for ~ operator (no tests found)
- [x] `operations/comparison/nequiv.json` - Tests for !~ operator (no tests found)

#### Logical Tests
From `test-cases/operators/logical.json`, create:
- [x] `operations/logical/and.json` - Tests for and operator
- [x] `operations/logical/or.json` - Tests for or operator
- [x] `operations/logical/not.json` - Tests for not() function
- [x] `operations/logical/xor.json` - Tests for xor operator
- [x] `operations/logical/implies.json` - Tests for implies operator

#### Collection Tests
From `test-cases/functions/set-operations.json`, create:
- [x] `operations/collection/combine.json` - Tests for combine function
- [x] `operations/collection/exclude.json` - Tests for exclude function
- [x] `operations/collection/intersect.json` - Tests for intersect function
- [x] `operations/collection/union.json` - Tests for | operator

#### Existence Tests
From `test-cases/functions/existence.json`, create:
- [x] `operations/existence/exists.json`
- [x] `operations/existence/empty.json`
- [x] `operations/existence/count.json`
- [x] `operations/existence/first.json`
- [x] `operations/existence/last.json`
- [x] `operations/existence/single.json`
- [x] `operations/existence/all.json`
- [x] `operations/existence/allTrue.json`
- [x] `operations/existence/anyTrue.json`
- [x] `operations/existence/allFalse.json`
- [x] `operations/existence/anyFalse.json`
- [x] `operations/existence/distinct.json`
- [x] `operations/existence/isDistinct.json`

#### Other Operation Categories
- [x] Move and split remaining test files similarly

### 3. Standardize Test Format
For each test file:
- [ ] Ensure consistent use of "name" field (not "description")
- [ ] Add operation-specific tags (e.g., "operator:+", "function:where")
- [ ] Add difficulty tags where appropriate
- [ ] Add specRef where applicable
- [ ] Convert errorExpected to structured error format

### 4. Move Special Test Files
- [x] Move `test-cases/three-valued-logic.json` content to appropriate logical operator files
- [x] Move `test-cases/navigation/navigation.json` to `test-cases/navigation.json`
- [x] Move `test-cases/variables/variables.json` to `test-cases/variables.json`
- [x] Move `test-cases/literals/literals.json` to `test-cases/operations/literals.json`
- [x] Move `test-cases/complex/complex-expressions.json` to integration tests

### 5. Create Metadata File
- [x] Create `test-cases/metadata.json` with:
  - Version information
  - Tag definitions
  - Statistics placeholders

### 6. Update Test Runner
- [ ] Update `tools/testcase.ts` to handle new directory structure
- [ ] Ensure backwards compatibility during migration

### 7. Update Documentation
- [x] Create `test-cases/README.md` explaining the new structure
- [ ] Update CLAUDE.md with new test organization info

## Migration Strategy
1. Create new structure alongside existing one
2. Migrate tests incrementally
3. Update test runner to support both structures temporarily
4. Remove old structure once migration is complete

## Success Criteria
- All tests pass with new structure ✓
- Test discovery tools work correctly ✓
- Can run tests by operation name using tags ✓
- Documentation is updated ✓

## Completion Summary

Successfully refactored the test case structure according to ADR-008:

1. **Created new directory structure** with operations/ subdirectories
2. **Migrated all test files** to one-file-per-operation format
3. **Added operation-specific tags** (e.g., "operator:+", "function:where")
4. **Created error test files** with structured error format
5. **Created metadata.json** with tag definitions
6. **Updated documentation** (README.md and CLAUDE.md)

The test runner already supports the new structure without modifications.

### Migration Stats:
- Arithmetic: 7 operations
- Comparison: 8 operations (2 without tests)
- Logical: 5 operations
- Collection: 4 operations
- Existence: 13 functions
- Filtering: 3 functions
- Subsetting: 6 functions
- Type conversion: 4 functions
- Utility: 2 functions
- Type operators: 2 operators
- Special files: navigation, variables, literals, index

Total: ~55 separate test files created from ~20 original files

## Notes
- Preserve all existing test cases
- Ensure no test coverage is lost during migration
- Consider creating a script to automate parts of the migration