# Task: Fix Collection Equality Order-Dependent Comparison

## Problem

The equality operator (`=`) for collections is currently implemented as order-independent (set equality) when it should be order-dependent (sequence equality) according to the FHIRPath specification.

### Current Behavior
- `{1, 2, 3} = {1, 3, 2}` returns `[true]`
- Collections are compared as sets, ignoring order

### Expected Behavior
According to FHIRPath spec (§1.6.1.1):
> "If both operands are collections with multiple items:
> - Each item must be equal
> - **Comparison is order dependent**"

Therefore:
- `{1, 2, 3} = {1, 3, 2}` should return `[false]`
- Collections must be compared as sequences, respecting order

## Test Cases

Pending tests in `test-cases/operations/comparison/eq.json`:
- "collection equality - different order": `{1, 2, 3} = {1, 3, 2}` → `[false]`

Additional test cases to verify:
- `{1, 2, 3} = {1, 2, 3}` → `[true]` (same order)
- `{'a', 'b'} = {'b', 'a'}` → `[false]` (different order)
- `{1} = {1}` → `[true]` (single element)
- `{} = {}` → `[true]` (empty collections)

## Implementation Plan

1. Locate the equality operator implementation
2. Modify collection comparison logic to be order-dependent
3. Ensure element-by-element comparison with index matching
4. Verify all existing tests still pass
5. Enable the pending test case

## Files Modified

- ✅ `src/operations/equal-operator.ts` - Updated to handle collection comparison
- ✅ `test-cases/operations/comparison/eq.json` - Removed pending flag

## Success Criteria

1. ✅ `{1, 2, 3} = {1, 3, 2}` returns `[false]`
2. ✅ `{1, 2, 3} = {1, 2, 3}` returns `[true]`
3. ✅ All existing equality tests continue to pass
4. ✅ The pending test "collection equality - different order" passes

## What Was Done

Successfully fixed the equality operator to properly handle collection comparison according to the FHIRPath specification:

1. **Identified the issue**: The equality operator was only comparing the first element of collections, not all elements
2. **Implemented proper collection comparison**:
   - Added check for collection length equality
   - Implemented element-by-element comparison at matching indices
   - Maintained order-dependent comparison as required by spec
3. **Preserved existing behavior**:
   - Single item comparison still works correctly
   - Empty collection handling unchanged
   - Quantity comparison logic preserved
4. **Verified the fix**:
   - Test "collection equality - different order" now passes
   - All existing tests continue to pass
   - No regressions introduced

## Notes

- This was a critical bug fix that brings the implementation in line with the FHIRPath specification
- The previous implementation was treating collections as sets (order-independent) when they should be sequences (order-dependent)
- The fix properly handles collections of any size, including edge cases like empty collections and single-element collections