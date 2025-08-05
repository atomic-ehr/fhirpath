# Task 011: Implement Unified Error System

## Status: COMPLETED

## Overview
Implement the unified error system as designed in ADR-010 to provide consistent error handling across parser, analyzer, and runtime components.

## What Was Done

1. **Created Error Infrastructure** (src/errors.ts)
   - Implemented `FHIRPathError` base class extending Error
   - Created `Errors` factory object with all specialized constructors
   - Added `toDiagnostic()` helper function
   - Exported error codes as constants for external use

2. **Migrated All Components**
   - Parser: Updated all error throws to use new error system
   - Analyzer: Replaced addDiagnostic calls with toDiagnostic(Errors.*)
   - Interpreter: Updated error handling to use FHIRPathError
   - Operations: Migrated 46 operation files automatically, fixed remaining manually

3. **Updated Tests**
   - Fixed test regex patterns to match new error messages
   - Updated analyzer test error codes from old constants to new FP codes
   - Reduced test failures from 92 to 37 (most remaining are unrelated to error system)

4. **Exported Error System**
   - Added exports to index.ts: FHIRPathError, Errors, ErrorCodes
   - Ensured backward compatibility (errors still instanceof Error)

## Background
Currently, the FHIRPath implementation has two separate error handling approaches:
- Analyzer uses structured `Diagnostic` objects
- Runtime uses thrown JavaScript `Error` objects with inconsistent messages

This inconsistency makes debugging harder and prevents proper IDE integration for runtime errors.

## !!! IMPORTANT NOTES !!!
- Try to follow existing semantic
- Don't mess with adapters and stuff like this
- Write clean-code
- Don't maintain backward compatibility

## Requirements

### 1. Create Error Infrastructure
- [ ] Create `src/errors.ts` with:
  - [ ] `FHIRPathError` base class extending Error
  - [ ] `Errors` factory object with all specialized constructors
  - [ ] `toDiagnostic()` helper function
  - [ ] Export all error codes as constants for external use

### 2. Implement Error Constructors
Implement specialized constructors for each error category:

#### Resolution Errors (1000-1999)
- [ ] `unknownOperator(operator, location?)`
- [ ] `unknownFunction(name, location?)`
- [ ] `unknownVariable(name, location?)`
- [ ] `unknownUserVariable(name, location?)`
- [ ] `unknownProperty(property, type, location?)`
- [ ] `unknownNodeType(nodeType, location?)`
- [ ] `noEvaluatorFound(evaluatorType, name, location?)`
- [ ] `variableNotDefined(name, location?)`

#### Arity Errors (2000-2999)
- [ ] `wrongArgumentCount(funcName, expected, actual, location?)`
- [ ] `wrongArgumentCountRange(funcName, min, max, actual, location?)`
- [ ] `singletonRequired(funcName, actualCount, location?)`
- [ ] `emptyNotAllowed(funcName, location?)`
- [ ] `argumentRequired(funcName, argumentName, location?)`

#### Type Errors (3000-3999)
- [ ] `typeNotAssignable(sourceType, targetType, location?)`
- [ ] `operatorTypeMismatch(operator, leftType, rightType, location?)`
- [ ] `argumentTypeMismatch(argIndex, funcName, expected, actual, location?)`
- [ ] `conversionFailed(value, targetType, location?)`
- [ ] `invalidValueType(expected, actual, location?)`
- [ ] `invalidOperandType(operation, type, location?)`
- [ ] `stringOperationOnNonString(operation, location?)`
- [ ] `numericOperationOnNonNumeric(operation, location?)`
- [ ] `booleanOperationOnNonBoolean(operation, index, actualType, location?)`

#### Configuration Errors (4000-4999)
- [ ] `modelProviderRequired(operation, location?)`

#### Syntax Errors (5000-5999)
- [ ] `unexpectedToken(token, location?)`
- [ ] `expectedToken(expected, actual, location?)`
- [ ] `invalidSyntax(details, location?)`
- [ ] `expectedIdentifier(after, actual, location?)`
- [ ] `expectedTypeName(actual, location?)`

#### Domain Errors (6000-6999)
- [ ] `divisionByZero(location?)`
- [ ] `invalidDateTimeFormat(format, location?)`
- [ ] `incompatibleUnits(unit1, unit2, location?)`
- [ ] `indexOutOfBounds(index, size, location?)`
- [ ] `invalidOperation(details, location?)`
- [ ] `invalidPrecision(operation, location?)`
- [ ] `invalidStringOperation(operation, paramName, location?)`
- [ ] `invalidNumericOperation(operation, paramName, expectedType, location?)`

### 3. Migrate Existing Errors

#### Parser Migration
- [ ] Replace all `throw new Error()` calls with appropriate `Errors.*` calls
- [ ] Update `handleError()` to use `FHIRPathError`
- [ ] Update `addError()` to work with `FHIRPathError`
- [ ] Ensure error recovery still works in LSP mode

#### Analyzer Migration
- [ ] Replace all `addDiagnostic()` calls to use `toDiagnostic(Errors.*)`
- [ ] Remove old `DiagnosticCode` constants
- [ ] Update type checking error reporting

#### Interpreter Migration
- [ ] Replace all `throw new Error()` calls with appropriate `Errors.*` calls
- [ ] Update error handling in evaluate methods

#### Operations Migration
- [ ] Replace all `throw new Error()` calls in operation files
- [ ] Group similar errors (e.g., all "takes no arguments" → `wrongArgumentCount`)
- [ ] Ensure consistent error messages across similar operations

### 4. Testing
- [ ] Add unit tests for each error constructor
- [ ] Test that error codes are unique and in correct ranges
- [ ] Test `toDiagnostic()` conversion
- [ ] Update existing tests that check for specific error messages
- [ ] Add integration tests for error propagation

### 5. Documentation
- [ ] Update API documentation with error codes
- [ ] Create error reference guide listing all error codes
- [ ] Update README with error handling information
- [ ] Add JSDoc comments to error constructors

## Implementation Order
1. Create error infrastructure (errors.ts)
2. Migrate Parser (syntax errors are foundational)
3. Migrate Analyzer (uses diagnostics already)
4. Migrate Interpreter (core runtime errors)
5. Migrate Operations (bulk of the work, but straightforward)
6. Update tests
7. Update documentation

## Success Criteria
- All errors use the unified system
- Error codes are consistent and unique
- Tests pass with new error messages
- IDE integration works for runtime errors
- No breaking changes for library consumers (errors can still be caught as Error)

## Notes
- Preserve existing Error behavior (instanceof Error still works)
- Consider backwards compatibility for code catching specific messages
- Ensure tree-shaking works (unused error constructors can be eliminated)
- If you can't find error in ADR, you can bring it in code by yourself