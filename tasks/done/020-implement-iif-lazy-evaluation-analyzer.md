# Task: Implement iif Lazy Evaluation in Analyzer

## Problem

The analyzer currently analyzes all branches of `iif` expressions, even when the condition is a literal `true` or `false`. This violates the FHIRPath specification which requires lazy evaluation for `iif`.

### Current Behavior
- Analyzer checks all branches regardless of condition value
- Reports type errors in unreachable branches
- Prevents legitimate use of `iif` as a guard mechanism

### Expected Behavior
According to FHIRPath spec (§1.5.5.1):
> "Note that short-circuit behavior is expected in this function. In other words, `true-result` should only be evaluated if the `criterion` evaluates to true, and `otherwise-result` should only be evaluated otherwise."

## Requirements

1. **For literal conditions (`true`/`false`)**:
   - Skip type checking in unreachable branches
   - Emit warning about unreachable code
   - Only analyze the reachable branch

2. **For dynamic conditions**:
   - Analyze both branches (current behavior)
   - No unreachable code warnings

3. **Warning messages**:
   - "Unreachable code: false branch will never execute" (when condition is literal `true`)
   - "Unreachable code: true branch will never execute" (when condition is literal `false`)

## Implementation Steps

1. **Add UNREACHABLE_CODE error code** ✅
   - Added `ErrorCodes.UNREACHABLE_CODE = 'FP7001'` in `src/errors.ts`

2. **Update analyzer's visitFunctionCall method**: ✅
   - Added special case for `iif` that calls `handleIifFunction`
   - Implemented `handleIifFunction` method that:
     - Validates function exists and argument count
     - Checks if condition is a literal boolean
     - Only analyzes reachable branches
     - Emits warnings for unreachable code

3. **Handle nested iif expressions**: ✅
   - Lazy evaluation properly propagates through nested iif calls

## Test Cases

Tests have been added to `test/analyzer.test.ts` under "iif lazy evaluation" describe block:

- ✅ Dynamic condition - analyzes both branches
- ✅ Literal true - warns about unreachable false branch, doesn't analyze it
- ✅ Literal false - warns about unreachable true branch, doesn't analyze it
- ✅ Valid branches with literal conditions - only warns
- ✅ Nested iif - handles multiple levels of lazy evaluation
- ✅ Complex unreachable expressions - not analyzed

## Files Modified

- `src/analyzer.ts` - ✅ Added special handling for `iif` in `visitFunctionCall` and new `handleIifFunction` method
- `src/errors.ts` - ✅ Added UNREACHABLE_CODE error code
- `test/analyzer.test.ts` - ✅ Added comprehensive test suite for iif lazy evaluation

## Example Expressions

```fhirpath
// Should pass with warning about unreachable false branch
iif(true, true, (1 | 2).toString())

// Should pass with warning about unreachable true branch  
iif(false, (1 | 2).toString(), true)

// Should report error in true branch (dynamic condition)
iif(name.exists(), (1 | 2).toString(), 'default')
```

## Success Criteria

1. ✅ All tests in "iif lazy evaluation" test suite pass
2. ✅ The two failing test cases in `test-cases/operations/utility/iif.json` pass:
   - ✅ "iif - lazy evaluation with true condition"
   - ✅ "iif - lazy evaluation with false condition"
3. ✅ Analyzer respects FHIRPath spec's lazy evaluation requirement for `iif`

## What Was Done

Successfully implemented lazy evaluation for `iif` in the analyzer by:

1. **Added special handling** in `visitFunctionCall` that delegates `iif` to a dedicated handler
2. **Implemented `handleIifFunction`** that:
   - Detects literal boolean conditions (`true`/`false`)
   - Only analyzes the reachable branch when condition is literal
   - Emits warnings for unreachable code with appropriate messages
   - Falls back to analyzing both branches for dynamic conditions
3. **Added UNREACHABLE_CODE error code** (FP7001) with Warning severity
4. **Created comprehensive test suite** covering all scenarios

The implementation correctly balances static analysis (warning about dead code) with respecting FHIRPath's lazy evaluation semantics (not analyzing unreachable branches for type errors).

## Notes

- This change makes the analyzer more permissive for `iif` with literal conditions
- Aligns with how TypeScript/Java handle dead code in conditional expressions
- Enables `iif` to be used as intended for avoiding runtime errors