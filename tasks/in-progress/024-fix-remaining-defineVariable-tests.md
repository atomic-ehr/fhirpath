# Task 024: Fix Remaining defineVariable Tests

## Problem Statement

After completing Task 023, 7 `defineVariable` tests remain pending. This task analyzes these tests, verifies the analysis against the codebase, and proposes a detailed implementation plan.

## Verification and Additional Context

The initial analysis is correct. Verification against the codebase provides the following context:

1.  **Test Location**: The tests are defined in `test-cases/operations/utility/defineVariable.json`. Tests are marked as pending directly in the test file using a `"pending"` field with a reason string.
2.  **Analyzer Scope Limitations**: The root cause for the union (`|`) operator tests is that the `Analyzer`'s scope management in `src/analyzer.ts` does not currently treat the left and right sides of a union as distinct lexical scopes. The analyzer processes all binary operators (including union `|`) through a single `visitBinaryOperator` method. Currently, this method:
    - Visits the left operand first: `this.visitNode(node.left)`
    - Then visits the right operand: `this.visitNode(node.right)`
    - Variables defined in the left branch remain in scope when visiting the right branch
    - This is incorrect for union operators where each branch should have independent variable scopes
    
    The fix requires detecting when the operator is `|` and creating separate variable scopes for each branch, preventing variables from the left side from being visible in the right side.
3.  **Spec Ambiguity**: The points on system variable protection and dynamic variable names are valid. The FHIRPath specification is silent or ambiguous on these topics. Documenting the chosen implementation behavior is the correct path forward.

## Analysis of Remaining 7 Pending Tests

*(The original analysis of the 7 tests is accurate and remains unchanged.)*

### 1. Variable Scope Across Union Operator (3 tests)
- **Tests**: `defineVariable9`, `defineVariable12`, `dvUsageOutsideScopeThrows`
- **Root Cause**: Variables defined on one side of a union (`|`) are not accessible on the other. This is correct behavior.
- **Fix Needed**: The analyzer should detect this at analysis time, not runtime.

### 2. Complex Nested Variable Scoping (2 tests)
- **Test**: `defineVariable15`
  - **Status**: WORKING CORRECTLY.
  - **Fix Needed**: Unmark as pending.
- **Test**: `defineVariable16`
  - **Root Cause**: `%v1` is out of scope, so the runtime error is correct.
  - **Fix Needed**: The test expectation is wrong; it should expect an error.

### 3. System Variable Protection (1 test)
- **Test**: `dvCantOverwriteSystemVar`
- **Root Cause**: The implementation currently allows overriding system variables like `%context`.
- **Fix Needed**: Decide on a policy (allow, forbid, or flag) and document it. Forbidding is recommended for safety.

### 4. Dynamic Variable Names (1 test)
- **Test**: `defineVariable19`
- **Root Cause**: The first argument to `defineVariable` is expected to be a string literal, not an expression.
- **Fix Needed**: Document this as an intentional limitation.

---

## Enhanced Implementation Plan

### Phase 1: Quick Fix (1 test)
1.  **Task**: Unmark `defineVariable15` as pending.
    -   **Action**: Edit `test-cases/operations/utility/defineVariable.json`.
    -   **Detail**: Remove the `"pending"` field from the `defineVariable15` test object.

### Phase 2: Correct Test Expectations (2 tests)
1.  **Task**: Update tests where the current error is correct but the expectation is wrong.
    -   **Action**: Edit `test-cases/operations/utility/defineVariable.json`.
    -   **`defineVariable12`**: Change the test expectation from `"expected": []` to an `"error"` field with the code `FP1004` (Unknown user variable).
    -   **`defineVariable16`**: Same as above. The variable `%v1` is out of scope, so an error is correct. Change `"expected": []` to expect an `FP1004` error.

### Phase 3: Analyzer Enhancement for Union Scopes (3 tests)
1.  **Task**: Implement proper scope tracking for the union operator.
    -   **Action**: Modify `src/analyzer.ts`.
    -   **Goal**: Make the analyzer aware of scope boundaries across the union operator (`|`).
    -   **Implementation Details**:
        1.  In the `visitBinaryOperator` method (around line 172), add special handling for the union operator:
            ```typescript
            if (node.operator === '|') {
              // Save current variable scope
              const originalScope = this.currentScope;
              
              // Visit left branch with current scope
              this.visitNode(node.left);
              
              // Reset to original scope for right branch
              // (variables from left branch should not be visible)
              this.currentScope = originalScope;
              this.visitNode(node.right);
              
              // Restore original scope
              this.currentScope = originalScope;
            } else {
              // Normal handling for other operators
              this.visitNode(node.left);
              this.visitNode(node.right);
            }
            ```
        2.  This requires adding a variable scope tracking mechanism to the Analyzer class if not already present.
        3.  The scope should track user-defined variables (those starting with `%`) created by `defineVariable`.
    -   **Benefit**: This will cause `defineVariable9`, `dvUsageOutsideScopeThrows`, and potentially `defineVariable12` to be caught correctly at analysis time rather than runtime.

### Phase 4: Document Design Decisions (2 tests)
1.  **Task**: Implement and document a policy for system variables.
    -   **Action**: Modify `src/interpreter.ts` or `src/analyzer.ts` and documentation.
    -   **Decision**: Add protection as an implementation-specific feature.
    -   **Code Change**: Add a check within the `defineVariable` logic to see if the variable name is a known system variable (e.g., `%context`, `%ucum`) and throw an error if it is.
    -   **Documentation**: In `docs/implementation-details.md`, document this as a deliberate design choice for safety.

2.  **Task**: Document the limitation for dynamic variable names.
    -   **Action**: Update documentation.
    -   **Decision**: Mark as "won't fix" due to spec limitations.
    -   **Documentation**: Add a note to `docs/implementation-details.md` stating that the first argument to `defineVariable` must be a string literal.
    -   **Test Case**: Keep the test as pending with clear documentation that dynamic variable names are not supported by design.

## Success Criteria

- **Immediate**: 1 test (`defineVariable15`) is no longer pending and passes.
- **Short-term**: 2 tests (`defineVariable12`, `defineVariable16`) have corrected expectations and pass. 3 tests (`defineVariable9`, `dvUsageOutsideScopeThrows`, `defineVariable12`) fail at analysis time instead of runtime.
- **Long-term**: Clear documentation exists for system variable protection and dynamic variable name limitations.
- **Final State**: All 7 tests are either passing, correctly failing at analysis time, or documented as intentional limitations/unsupported features.
