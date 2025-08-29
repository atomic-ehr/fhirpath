# Task 007: Implement repeat() Function

## Objective
Implement the `repeat` function in FHIRPath, which repeatedly applies an expression until no new items are returned.

## Function Specification

### repeat(expression) : collection
The `repeat` function is used to traverse recursive structures by repeatedly applying an expression to each item in a collection until no new items are produced.

**Behavior:**
- Takes a single expression as argument
- Applies the expression to the input collection
- Continues applying the expression to all results iteratively
- Stops when no new items are produced (fixed point reached)
- Returns the cumulative collection of all items encountered
- Avoids infinite loops by tracking already-seen items

**Use Cases:**
- Traversing hierarchical structures
- Following references recursively
- Expanding nested relationships

## Implementation Steps

### Phase 1: Research and Analysis
- [ ] Search for repeat function in FHIRPath spec
- [ ] Find test cases in fhirpath.js:
  - [ ] Check `fhirpath.js/test/cases/*.yaml`
  - [ ] Look for repeat-specific test files
- [ ] Find test cases in XML test suite:
  - [ ] Check `spec/fhirpathlab-tests/*.xml`
- [ ] Understand cycle detection requirements
- [ ] Research implementation patterns in reference implementations

### Phase 2: Implementation
- [ ] Create `operations/repeat-function.ts`
- [ ] Implement core logic:
  - [ ] Expression evaluation loop
  - [ ] Cycle detection (track seen items)
  - [ ] Result accumulation
  - [ ] Termination condition
- [ ] Handle edge cases:
  - [ ] Empty input
  - [ ] Self-referential structures
  - [ ] Maximum iteration limits
- [ ] Register in operations/index.ts

### Phase 3: Testing
- [ ] Create `test-cases/operations/filtering/repeat.json`
- [ ] Port tests from fhirpath.js
- [ ] Port tests from XML suite
- [ ] Add tests for:
  - [ ] Simple repetition
  - [ ] Recursive structures
  - [ ] Cycle detection
  - [ ] Empty propagation
  - [ ] Error conditions

### Phase 4: Documentation
- [ ] Update `docs/implementation-status.md`
- [ ] Run TypeScript validation
- [ ] Run full test suite
- [ ] Document any implementation decisions

## Success Criteria
- Function correctly implements repeat semantics
- Cycle detection prevents infinite loops
- All ported tests pass
- TypeScript compilation successful
- Documentation updated

## What Was Done

### Implementation Completed
- ✅ Created `src/operations/repeat-function.ts` with full implementation
- ✅ Implemented cycle detection using equality comparison
- ✅ Registered function in operations/index.ts (auto-registered by registry)
- ✅ Added TypeScript analysis support

### Key Implementation Details
- Uses queue-based approach to iteratively apply expression
- Prevents duplicates using collectionsEqual comparison
- Handles empty input and null values correctly
- Supports complex tree traversal (e.g., Questionnaire.repeat(item))

### Tests Created
- ✅ Created comprehensive test suite in `test-cases/operations/filtering/repeat.json`
- ✅ Ported tests from fhirpath.js test cases
- ✅ Added tests for:
  - Simple object property repetition
  - Collection handling
  - Infinite loop prevention
  - Tree traversal (Questionnaire, ValueSet examples)
  - Null value handling
  - Empty input cases
- ✅ All 12 tests passing

### Documentation Updated
- ✅ Updated `docs/implementation-status.md`
- ✅ Function coverage increased from 96% to 98% (78/80 functions)
- ✅ Filtering and Projection Functions now 100% complete (4/4)

### Completion Date
2025-08-29

## Technical Notes

### Algorithm Sketch
```typescript
function repeat(expression) {
  let result = [];
  let current = input;
  let seen = new Set();
  
  while (current.length > 0) {
    let next = [];
    for (item of current) {
      if (!seen.has(item)) {
        seen.add(item);
        result.push(item);
        let evaluated = evaluate(expression, item);
        next.push(...evaluated);
      }
    }
    current = next;
  }
  
  return result;
}
```

### Considerations
- Need to handle object equality for cycle detection
- May need to limit maximum iterations for safety
- Should preserve order of results
- Empty propagation rules apply

## References
- FHIRPath Specification: Section on Filtering and Projection
- Similar to: descendants() but with custom expression
- Related functions: children(), descendants()