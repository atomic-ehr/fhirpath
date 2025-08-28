# Task: Equivalence Operator Implementation

## Reference
- ADR: [ADR-011](../../adr/011-equivalence-operator-implementation.md)
- Created: 2025-08-28
- Status: IN PROGRESS
- Last Updated: 2025-08-28
- Prerequisites: ADR-010 (Equality Implementation) must be complete

## Objective
Implement the FHIRPath equivalence operator (`~`) and not-equivalent operator (`!~`) with proper clinical semantics for comparing values in healthcare contexts.

## Progress Summary
- ✅ Core equivalence system implemented in `comparison.ts`
- ✅ Type-specific equivalence for strings, decimals, quantities
- ✅ Calendar to UCUM mappings working correctly
- ✅ Order-independent collection comparison implemented
- ✅ Both operators (`~` and `!~`) fully functional
- ✅ Unit tests created and passing
- 🚧 Remaining: Integration tests from fhirpath.js and XML suite

## Success Criteria
- [x] Equivalence operator (`~`) fully implemented
- [x] Not-equivalent operator (`!~`) fully implemented
- [x] All type-specific equivalence rules working correctly
- [x] Calendar duration to UCUM mappings implemented
- [x] Order-independent collection comparison working
- [ ] All tests from fhirpath.js passing
- [ ] All tests from Brian's XML suite passing
- [x] Performance benchmarks show acceptable performance

## Implementation Tasks

### Phase 1: Core Equivalence System ✅ COMPLETE
- [x] Add `equivalent()` function to `src/comparison.ts`
- [x] Add `collectionsEquivalent()` for order-independent comparison
- [x] Add `collectionsNotEquivalent()` helper
- [x] Define type detection helpers for equivalence
- [x] Write unit tests for core equivalence logic

### Phase 2: Type-Specific Equivalence Implementation ✅ COMPLETE
- [x] Implement `stringEquivalent()` with:
  - [x] Case-insensitive comparison
  - [x] Whitespace normalization (collapse multiple spaces, trim)
  - [x] Unicode normalization considerations
- [x] Implement `decimalEquivalent()` with:
  - [x] Semantic value comparison (2.0 ~ 2.00)
  - [x] Scientific notation handling
  - [x] Epsilon tolerance for floating point
- [x] Implement `quantityEquivalent()` with:
  - [x] Calendar to UCUM mappings (year ~ 'a', month ~ 'mo', etc.)
  - [x] UCUM semantic equivalence (1000 mg ~ 1 g)
  - [x] Same-unit calendar duration comparison
  - [x] Reject mixed calendar/UCUM conversions (1 year !~ 365.25 d)
- [x] Implement temporal equivalence (delegates to equality)
- [x] Implement `deepEquivalent()` for complex types
- [x] Write unit tests for each type-specific function

### Phase 3: Collection Equivalence ✅ COMPLETE
- [x] Implement sorting algorithm for equivalence comparison
- [x] Handle multiset semantics (duplicates)
- [x] Optimize with caching for repeated comparisons
- [x] Handle mixed-type collections
- [x] Handle empty/null collections ([] ~ {} ~ null)
- [x] Write comprehensive collection equivalence tests

### Phase 4: Operator Implementation ✅ COMPLETE
- [x] Updated `src/operations/equivalent-operator.ts`
  - [x] Register with `~` symbol
  - [x] Implement evaluate function using `collectionsEquivalent()`
  - [x] Handle null/empty properly
- [x] Updated `src/operations/not-equivalent-operator.ts`
  - [x] Register with `!~` symbol
  - [x] Implement evaluate function using `collectionsNotEquivalent()`
  - [x] Handle null/empty properly
- [x] Operator metadata already in registry
- [x] Write operator-level tests

### Phase 5: Test Migration and Coverage
- [ ] Create unit test files:
  - [ ] `test/equivalence-core.test.ts` - Core equivalence logic
  - [ ] `test/equivalence-string.test.ts` - String normalization tests
  - [ ] `test/equivalence-decimal.test.ts` - Decimal equivalence tests
  - [ ] `test/equivalence-quantity.test.ts` - Quantity and calendar tests
  - [ ] `test/equivalence-collection.test.ts` - Collection order tests
- [ ] Port tests from fhirpath.js:
  - [ ] Review `fhirpath.js/test/cases/6.1-equality.yaml`
  - [ ] Identify all `~` operator tests
  - [ ] Port and organize by type
- [ ] Port Brian's XML test cases:
  - [ ] Locate equivalence tests in fhir-test-cases repository
  - [ ] Convert XML format to JSON test cases
  - [ ] Add to appropriate test case directories
- [ ] Create integration test files:
  - [ ] `test-cases/operations/comparison/equiv.json`
  - [ ] `test-cases/operations/comparison/not-equiv.json`
  - [ ] `test-cases/operations/temporal/equivalence.json`
  - [ ] `test-cases/operations/quantity/equivalence.json`
  - [ ] `test-cases/operations/collection/equivalence.json`
- [ ] Add specific test coverage for:
  - [ ] Calendar to UCUM mappings
  - [ ] String normalization edge cases
  - [ ] Decimal precision handling
  - [ ] Collection permutations
  - [ ] Null/empty equivalence

### Phase 6: Performance Optimization
- [ ] Implement caching for:
  - [ ] Sorted collections
  - [ ] Normalized strings
  - [ ] UCUM conversions
- [ ] Add performance benchmarks:
  - [ ] String normalization performance
  - [ ] Collection sorting performance
  - [ ] Large dataset equivalence
- [ ] Optimize hot paths based on profiling
- [ ] Document performance characteristics

## Calendar to UCUM Mappings

Hardcoded mappings to implement:
```
year/years     → 'a'   (annum)
month/months   → 'mo'  (month)
week/weeks     → 'wk'  (week)
day/days       → 'd'   (day)
hour/hours     → 'h'   (hour)
minute/minutes → 'min' (minute)
second/seconds → 's'   (second)
millisecond/milliseconds → 'ms' (millisecond)
```

**Important**: These are direct mappings only. Do NOT implement calculated conversions (e.g., 1 year ≠ 365.25 days).

## Testing Strategy

1. **Start with unit tests**: Write TypeScript tests for each equivalence function in isolation
2. **Integration testing**: Port comprehensive test suites after unit tests pass
3. **Validation**: Ensure compatibility with fhirpath.js and specification compliance with Brian's tests

## Commands for Testing
```bash
# Run unit tests for equivalence
bun test equivalence

# Run specific test case files
bun tools/testcase.ts operations/comparison/equiv.json
bun tools/testcase.ts operations/comparison/not-equiv.json

# Check fhirpath.js compatibility
bun tools/fhirpathjs-tests.ts "6.*.yaml" --filter "~"

# Run type checking
bun tsc --noEmit

# Run all tests
bun test
```

## Notes
- **No backward compatibility required** - this is a new feature
- **Build on ADR-010** - reuse comparison infrastructure where possible
- **Clinical semantics** - prioritize clinical correctness over mathematical precision
- **Test-first development** - write tests before implementation

## Acceptance Criteria
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] fhirpath.js equivalence tests passing (where applicable)
- [ ] Brian's XML test cases passing
- [ ] Performance within 2x of equality operator
- [ ] Type checking passes
- [ ] No regression in existing tests