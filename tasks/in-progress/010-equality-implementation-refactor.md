# Task: Equality Implementation Refactor

## Reference
- ADR: [ADR-010](../../adr/010-equality-implementation-refactor.md)
- Created: 2025-08-28
- Status: IN PROGRESS
- Last Updated: 2025-08-28

## Progress Summary
- ✅ Phase 1 Complete: Core comparison system implemented with tests
- ✅ Phase 3 Complete: Equality operators (`=` and `!=`) refactored and working
- ✅ Phase 4 Complete: Performance optimizations implemented with benchmarks
- ✅ Phase 5 Complete: Test migration done - 82 tests ported from fhirpath.js
- ✅ Deep equality implemented for complex types
- ✅ All tests passing (3965 tests)
- 🚧 Remaining: Documentation (Phase 6)

## Objective
Refactor the equality implementation to create a unified comparison system that addresses code duplication, fixes temporal type bugs, and improves performance.

## Success Criteria
- [x] All existing tests pass ✅
- [x] Temporal type equality works correctly in `!=` operator ✅
- [x] Code duplication eliminated between `=` and `!=` operators ✅
- [x] Deep equality implemented for complex FHIR types ✅
- [ ] Performance improvements measurable through benchmarks (optional)

## Implementation Tasks

### Phase 1: Core Comparison System ✅
- [x] Create `src/comparison.ts` module with unified comparison infrastructure
- [x] Define `ComparisonResult` type system
- [x] Implement base `compare()` function with type dispatch
- [x] Write unit tests for core comparison logic

### Phase 2: Type-Specific Implementations
- [ ] Implement `compareTemporal()` for Date/DateTime/Time
  - [ ] Fix timezone normalization
  - [ ] Add UTC conversion caching
  - [ ] Handle partial precision correctly
- [ ] Implement `compareQuantities()` with UCUM integration
  - [ ] Cache UCUM conversions
  - [ ] Handle calendar durations
  - [ ] Optimize dimensionless quantities
- [ ] Implement `compareComplex()` for deep equality
  - [ ] FHIR resource comparison
  - [ ] Nested structure handling
  - [ ] Property order independence
- [ ] Implement `comparePrimitive()` for basic types
- [ ] Write unit tests for each type-specific function

### Phase 3: Operator Refactoring ✅ COMPLETE
- [x] Refactor `equal-operator.ts` to use new comparison system
- [x] Refactor `not-equal-operator.ts` to use new comparison system
- [x] Update operator tests (equality tests passing)

### Phase 4: Performance Optimizations ✅ COMPLETE
- [x] Implement caching strategy
  - [x] UTC conversion cache for temporal types (WeakMap cache)
  - [x] UCUM quantity conversion cache (already implemented via _ucumQuantity)
  - [x] Comparison result cache for repeated operations (compareWithCache function)
- [x] Add early exit optimizations
  - [x] Type mismatch detection (early exit for primitive type mismatches)
  - [x] Length comparison for collections (immediate false/true for different lengths)
  - [x] Reference equality check (immediate return for same reference)
- [x] Implement lazy initialization
  - [x] UCUM quantity creation already deferred via getUcumQuantity
  - [x] Temporal normalization cached on demand
- [x] Create performance benchmarks (test/comparison-performance.test.ts)
- [x] Measure and document performance improvements:
  - Reference equality: ~2ms for 100k comparisons
  - UTC caching: ~45% faster on repeated comparisons
  - Comparison caching: ~64% faster for complex objects
  - Collection length mismatch: <1ms for 10k comparisons

### Phase 5: Test Migration and Coverage ✅ COMPLETE
- [x] Port equality tests from fhirpath.js
  - [x] Review `fhirpath.js/test/cases/6.1-equality.yaml`
  - [x] Reviewed for relevant edge cases
  - [x] Ported 82 tests total
- [x] Organize tests by type:
  - [x] Created `test-cases/operations/temporal/equality.json` (34 tests)
  - [x] Created `test-cases/operations/quantity/equality.json` (25 tests)  
  - [x] Created `test-cases/operations/collection/equality.json` (23 tests)
  - [x] Basic equality tests remain in `test-cases/operations/comparison/eq.json`
- [x] Add specific test coverage for:
  - [x] Temporal inequality bug fix (3 regression tests)
  - [x] Deep equality of complex types (6 tests in test/deep-equality.test.ts)
  - [x] Edge cases discovered during implementation

### Phase 6: Documentation and Cleanup
- [ ] Update inline documentation in new comparison module
- [ ] Document breaking changes to internal APIs
- [ ] Remove deprecated/legacy code
- [ ] Update ADR-010 status to "Implemented"
- [ ] Create migration guide if needed for any external consumers

## Testing Strategy

### Unit Tests (Phase 1)
Create test files:
- `test/comparison-core.test.ts` - Core comparison logic
- `test/comparison-temporal.test.ts` - Temporal comparisons
- `test/comparison-quantity.test.ts` - Quantity comparisons
- `test/comparison-complex.test.ts` - Deep equality tests

### Integration Tests (Phase 2)
Update/create JSON test cases:
- `test-cases/operations/comparison/eq.json`
- `test-cases/operations/comparison/neq.json`
- `test-cases/operations/temporal/comparison.json`
- `test-cases/operations/quantity/comparison.json`
- `test-cases/operations/collection/equality.json`

## Notes
- **No backward compatibility required** for internal APIs
- **Equivalence operator (`~`)** is out of scope
- Focus on correctness first, then optimize
- Keep FHIRPath specification semantics as the north star

## Acceptance Criteria
- [ ] All existing tests pass
- [ ] New tests from fhirpath.js and XML specs pass
- [ ] Performance benchmarks show improvement or no regression
- [ ] Code coverage maintained or improved
- [ ] No code duplication between equality operators
- [ ] Temporal types correctly handled in all operators

## Related Files
- `src/operations/equal-operator.ts`
- `src/operations/not-equal-operator.ts`
- `src/temporal.ts`
- `src/quantity-value.ts`
- `src/boxing.ts`
- `test/collection-equality.test.ts`

## Commands for Testing
```bash
# Run existing equality tests
bun test equality

# Run specific test case files
bun tools/testcase.ts operations/comparison/eq.json
bun tools/testcase.ts operations/comparison/neq.json

# Check fhirpath.js compatibility
bun tools/fhirpathjs-tests.ts "6.*.yaml" --filter "equal"

# Run type checking
bun tsc --noEmit

# Run all tests
bun test
```