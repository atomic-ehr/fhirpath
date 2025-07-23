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
- [ ] Create `test-cases/operations/` directory
- [ ] Create subdirectories for each operation category:
  - [ ] `arithmetic/`
  - [ ] `collection/`
  - [ ] `comparison/`
  - [ ] `existence/`
  - [ ] `filtering/`
  - [ ] `logical/`
  - [ ] `membership/`
  - [ ] `string/`
  - [ ] `subsetting/`
  - [ ] `type-conversion/`
  - [ ] `type-operators/`
  - [ ] `utility/`
- [ ] Create `test-cases/integration/` directory
- [ ] Create `test-cases/errors/` directory structure

### 2. Split Existing Test Files

#### Arithmetic Tests
From `test-cases/operators/arithmetic.json`, create:
- [ ] `operations/arithmetic/plus.json` - Tests for + operator
- [ ] `operations/arithmetic/minus.json` - Tests for - operator
- [ ] `operations/arithmetic/multiply.json` - Tests for * operator
- [ ] `operations/arithmetic/divide.json` - Tests for / operator
- [ ] `operations/arithmetic/div.json` - Tests for div operator
- [ ] `operations/arithmetic/mod.json` - Tests for mod operator
- [ ] `operations/arithmetic/concat.json` - Tests for & operator

#### Comparison Tests
From `test-cases/operators/comparison.json`, create:
- [ ] `operations/comparison/eq.json` - Tests for = operator
- [ ] `operations/comparison/neq.json` - Tests for != operator
- [ ] `operations/comparison/lt.json` - Tests for < operator
- [ ] `operations/comparison/gt.json` - Tests for > operator
- [ ] `operations/comparison/lte.json` - Tests for <= operator
- [ ] `operations/comparison/gte.json` - Tests for >= operator
- [ ] `operations/comparison/equiv.json` - Tests for ~ operator
- [ ] `operations/comparison/nequiv.json` - Tests for !~ operator

#### Logical Tests
From `test-cases/operators/logical.json`, create:
- [ ] `operations/logical/and.json` - Tests for and operator
- [ ] `operations/logical/or.json` - Tests for or operator
- [ ] `operations/logical/not.json` - Tests for not() function
- [ ] `operations/logical/xor.json` - Tests for xor operator
- [ ] `operations/logical/implies.json` - Tests for implies operator

#### Collection Tests
From `test-cases/functions/set-operations.json`, create:
- [ ] `operations/collection/combine.json` - Tests for combine function
- [ ] `operations/collection/exclude.json` - Tests for exclude function
- [ ] `operations/collection/intersect.json` - Tests for intersect function
- [ ] `operations/collection/union.json` - Tests for | operator

#### Existence Tests
From `test-cases/functions/existence.json`, create:
- [ ] `operations/existence/exists.json`
- [ ] `operations/existence/empty.json`
- [ ] `operations/existence/count.json`
- [ ] `operations/existence/first.json`
- [ ] `operations/existence/last.json`
- [ ] `operations/existence/single.json`
- [ ] `operations/existence/all.json`
- [ ] `operations/existence/allTrue.json`
- [ ] `operations/existence/anyTrue.json`
- [ ] `operations/existence/allFalse.json`
- [ ] `operations/existence/anyFalse.json`
- [ ] `operations/existence/distinct.json`
- [ ] `operations/existence/isDistinct.json`

#### Other Operation Categories
- [ ] Move and split remaining test files similarly

### 3. Standardize Test Format
For each test file:
- [ ] Ensure consistent use of "name" field (not "description")
- [ ] Add operation-specific tags (e.g., "operator:+", "function:where")
- [ ] Add difficulty tags where appropriate
- [ ] Add specRef where applicable
- [ ] Convert errorExpected to structured error format

### 4. Move Special Test Files
- [ ] Move `test-cases/three-valued-logic.json` content to appropriate logical operator files
- [ ] Move `test-cases/navigation/navigation.json` to `test-cases/navigation.json`
- [ ] Move `test-cases/variables/variables.json` to `test-cases/variables.json`
- [ ] Move `test-cases/literals/literals.json` to `test-cases/operations/literals.json`
- [ ] Move `test-cases/complex/complex-expressions.json` to integration tests

### 5. Create Metadata File
- [ ] Create `test-cases/metadata.json` with:
  - Version information
  - Tag definitions
  - Statistics placeholders

### 6. Update Test Runner
- [ ] Update `tools/testcase.ts` to handle new directory structure
- [ ] Ensure backwards compatibility during migration

### 7. Update Documentation
- [ ] Create `test-cases/README.md` explaining the new structure
- [ ] Update CLAUDE.md with new test organization info

## Migration Strategy
1. Create new structure alongside existing one
2. Migrate tests incrementally
3. Update test runner to support both structures temporarily
4. Remove old structure once migration is complete

## Success Criteria
- All tests pass with new structure
- Test discovery tools work correctly
- Can run tests by operation name using tags
- Documentation is updated

## Notes
- Preserve all existing test cases
- Ensure no test coverage is lost during migration
- Consider creating a script to automate parts of the migration