# Task 023: Fix defineVariable Pending Tests

## Problem Statement

There are 11 pending tests for the `defineVariable` function that need to be addressed. These tests reveal several issues with the current implementation:

### Issues Found

1. **Context Propagation Issues** (3 tests)
   - `defineVariable('x', $this)` - The $this context is not being correctly captured
   - `defineVariable('x', value)` - Nested property access not working when value is from input  
   - `defineVariable('x', $this.value)` - Combination of $this and property access failing

2. **Variable Redefinition Protection** (1 test)
   - `defineVariable('v1').defineVariable('v1')` - Should throw error when redefining variable in same scope
   - Currently allows redefinition silently

3. **System Variable Protection** (1 test)
   - `defineVariable('context', 'oops')` - Should prevent overriding system variables
   - Currently allows overriding system variables like $this, $index, $total, %context

4. **Variable Scoping Issues** (3 tests)
   - Variables defined in one branch of union (`|`) are incorrectly accessible in other branch
   - Analyzer cannot track dynamically created variables at analysis time
   - Test expects error but analyzer marks as valid

5. **Dynamic Variable Names** (1 test)
   - `defineVariable(defineVariable('param','ppp').select(%param), ...)` 
   - Using expression result as variable name not supported

6. **Complex Scoping Edge Cases** (2 tests)
   - Multi-tree variable access patterns
   - Nested select() with variable references across scopes

## Test Results Analysis

Running the tests shows:
- Some tests are actually passing in interpreter but marked pending (e.g., $this context tests)
- Variable redefinition doesn't throw error - just returns last value
- System variable override is silently ignored
- Cross-scope variable access correctly throws runtime error but analyzer doesn't catch it

## FHIRPath Specification Requirements

According to FHIRPath specification §1.5.10.3:
1. **Variable Definition**: `defineVariable(name: String [, expr: expression])`
   - Value is `expr` if present, otherwise input collection
   - Function returns input unchanged
   
2. **Error on Redefinition**: "If the name already exists in the current expression scope, the evaluation will end and signal an error to the calling environment"
   - **REQUIRED**: Must throw error when redefining variable
   - Current implementation silently ignores (SPEC VIOLATION)

3. **Scoping Rules**: "Functions that take an expression as an argument establish a scope for the iteration variables ($this and $index). If a variable is defined within such an expression, it is only available within that expression scope"
   - Variables limited to expression scope (correctly implemented)
   - $this and $index are iteration variables with special scoping

4. **Environment Variables** (§1.9):
   - %ucum and %context are predefined environment variables
   - Spec doesn't explicitly forbid overriding, but states they are "set for all contexts"
   - Attempting to access undefined environment variable results in error

## Implementation Plan (SPEC-ALIGNED)

### Phase 1: Fix Variable Redefinition (SPEC §1.5.10.3 - REQUIRED)
- **Action**: Modify `RuntimeContextManager.setVariable()` at line 122-124
- **Change**: Throw error instead of silently returning
- **Error**: `Errors.variableAlreadyDefined(name)` with code FP6005
- **Message**: "Variable '{name}' already defined in current scope"

### Phase 2: Environment Variable Handling (SPEC §1.9)
- **Spec Position**: No explicit prohibition on overriding %context/%ucum
- **Decision**: Follow spec literally - allow override with warning in development mode
- **Alternative**: If tests require protection, mark those tests as implementation-specific

### Phase 3: Fix Incorrectly Pending Tests
Tests that actually work and should be unmarked:
- "defineVariable - property access with $this" - Works correctly
- "defineVariable - nested property access" (line 101) - Works correctly  
- "defineVariable - nested property access" (line 122) - Works correctly

### Phase 4: Analyzer Improvements (Quality Enhancement)
- Track defineVariable declarations at analysis time
- Detect cross-scope variable usage errors before runtime
- Add proper scope boundaries for union operators (|)

### Phase 5: Document Spec Deviations
- Dynamic variable names: Not in spec, won't implement
- System variable protection: If implemented, document as extension
- Mark non-spec tests appropriately

## Files to Modify

- `/src/interpreter.ts` - RuntimeContextManager.setVariable() for protection checks
- `/src/operations/defineVariable-function.ts` - Main function implementation
- `/src/analyzer.ts` - Improve variable tracking and scope analysis
- `/test-cases/operations/utility/defineVariable.json` - Update test expectations

## Success Criteria

- **Spec Compliance**: Implementation must follow FHIRPath specification:
  - Variable redefinition throws error (SPEC REQUIRED)
  - Variables scoped correctly to expression context
  - Function returns input unchanged
  
- **Test Resolution**:
  - Fix variable redefinition to throw error (1 test)
  - Unmark incorrectly pending tests (3 tests)
  - Document spec deviations for remaining tests
  - Consider marking system variable tests as implementation-specific if spec doesn't require protection
  
- **No Regressions**: All currently passing tests must continue to pass

## Testing Strategy

1. Run each pending test individually to verify current behavior
2. Implement fixes incrementally
3. Run full test suite after each change
4. Use `bun tools/testcase.ts operations/utility/defineVariable.json --pending` to track progress

## Notes

- **Spec First**: Implementation follows FHIRPath specification strictly
- **Test Adjustments**: Some FHIRPath Lab tests may need adjustment if they conflict with spec
- **System Variables**: Spec (§1.9) doesn't explicitly forbid overriding %context/%ucum
  - If we protect them, document as implementation-specific extension
  - Alternative: Adjust tests to match spec behavior
- **Key Spec Quote**: "If the name already exists in the current expression scope, the evaluation will end and signal an error" - This is mandatory