# Task 030: Fix Remaining Parser Test Failures

## Overview
Address the remaining 37 failing parser tests by implementing missing features, fixing test expectations, and completing error recovery functionality.

## Background
After Task 027, we have 37 failing tests. Many failures are due to:
- Tests expecting errors for valid FHIRPath syntax
- Missing error recovery features in Diagnostic mode
- Incomplete implementation of Error and Incomplete AST nodes
- Tests for features not yet implemented

## Current Test Status
- Total tests: 761
- Passing: 722
- Failing: 39

## Failing Test Categories

### 1. Valid Syntax Treated as Errors
Several tests expect errors for valid FHIRPath expressions:
- "5 + + 3" is valid (unary plus: "5 + (+3)")
- Need to review and update test expectations

### 2. Missing Error Recovery Features
Diagnostic mode error recovery is not fully implemented:
- Error nodes not being created properly
- Incomplete nodes not implemented
- Partial AST generation not working
- Recovery sync points need work

### 3. Context-Specific Error Messages
Some tests expect very specific error messages with context that we're not providing:
- "found '+'" in error messages
- Specific wording for different contexts
- Related information in diagnostics

### 4. Parser Mode Behavior Tests
Tests for parser modes need attention:
- Some tests use modes[] array but we don't handle it
- Mode-specific behavior not fully tested
- Validate mode tests failing (mode not implemented)

## Tasks

### 1. Review and Update Test Expectations
- [ ] Identify tests expecting errors for valid syntax
- [ ] Update test cases to reflect correct FHIRPath behavior
- [ ] Add comments explaining why syntax is valid
- [ ] Create new tests for actual invalid syntax

### 2. Implement Error Recovery Features
- [ ] Complete Error node implementation
- [ ] Implement Incomplete node creation
- [ ] Add proper sync point recovery
- [ ] Ensure partial AST is generated in Diagnostic mode
- [ ] Test error recovery with multiple errors

### 3. Enhance Error Messages
- [ ] Add "found 'X'" to all relevant error messages
- [ ] Implement related information in diagnostics
- [ ] Add suggestions for common mistakes
- [ ] Ensure context is properly reflected in messages

### 4. Fix Mode-Specific Tests
- [ ] Handle tests with modes[] array
- [ ] Ensure each mode behaves correctly
- [ ] Add pending flags for unimplemented features
- [ ] Update test runner to handle mode-specific expectations

### 5. Special Cases
- [ ] Handle "Patient.name = John" (identifier vs string)
- [ ] Fix unclosed delimiter error reporting
- [ ] Handle trailing operators correctly
- [ ] Fix range tracking for errors

## Test Files to Focus On
1. `test-cases/parser/errors/contextual-messages.json`
2. `test-cases/parser/errors/multiple-errors.json`
3. `test-cases/parser/errors/recovery.json`
4. `test-cases/parser/errors/syntax-errors.json`
5. `test-cases/parser/modes/mode-behavior.json`

## Implementation Notes

### Error Recovery Example
```typescript
private recoverFromError(error: ParseError): ASTNode {
  // Create error node
  const errorNode = this.createErrorNode(error.token, error.message);
  
  // Skip to sync point
  while (!this.isAtEnd() && !this.isAtSyncPoint()) {
    this.advance();
  }
  
  // Try to continue parsing
  if (!this.isAtEnd()) {
    try {
      const remainingExpr = this.expression();
      // Create partial AST with error node
      return this.combineWithError(errorNode, remainingExpr);
    } catch (e) {
      // If recovery fails, return just the error node
      return errorNode;
    }
  }
  
  return errorNode;
}
```

### Test Update Example
```json
{
  "name": "unary plus is valid",
  "expression": "5 + + 3",
  "expected": [8],
  "comment": "This is valid FHIRPath: 5 + (+3) = 5 + 3 = 8"
}
```

## Success Criteria
1. All 761 tests passing
2. Error recovery working in Diagnostic mode
3. Clear error messages with context
4. Mode-specific behavior correctly tested
5. No regression in existing functionality

## Dependencies
- Task 027 completion (partially done)
- Understanding of FHIRPath specification
- Test infrastructure knowledge

## Estimated Effort
- Test review and updates: 3 hours
- Error recovery implementation: 5 hours
- Error message enhancements: 2 hours
- Mode-specific fixes: 2 hours
- Testing and validation: 2 hours
- **Total: ~14 hours**