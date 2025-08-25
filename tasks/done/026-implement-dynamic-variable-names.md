# Task 026: Implement Dynamic Variable Names

## Objective
Implement support for dynamic variable names in `defineVariable()` function to pass official FHIRPath Lab tests and ensure spec compliance.

## Background
- ADR-020 documents the decision to support dynamic variable names
- Test `[FHIRPath Lab] defineVariable19` currently fails because it uses computed variable names
- The FHIRPath spec doesn't require variable names to be literals

## Requirements
1. Allow first argument of `defineVariable()` to be an expression that evaluates to a string
2. Maintain full static analysis for literal variable names
3. Provide warnings (not errors) for undefined variables when dynamic variables are in scope
4. Pass test `defineVariable19` and related tests

## Implementation Plan
1. [x] Update `defineVariable-function.ts` to evaluate non-literal name arguments
2. [x] Add `hasDynamicVariables` flag to analysis context
3. [x] Update analyzer to handle dynamic variable names
4. [x] Adjust variable reference validation based on dynamic variable presence
5. [x] Update tests and verify all defineVariable tests pass

## What Was Done

Successfully implemented support for dynamic variable names in the `defineVariable()` function:

1. **Runtime Changes**: Modified `defineVariable-function.ts` to handle both literal and expression-based variable names:
   - Fast path for literal strings (existing behavior)
   - Slow path that evaluates expressions to get the variable name at runtime

2. **Analysis Context**: Added `hasDynamicVariables` boolean flag to `AnalysisContext` class:
   - Tracks whether any dynamic variables have been defined in the current scope
   - Propagates through context transformations

3. **Analyzer Updates**: Enhanced the analyzer to handle dynamic variable scenarios:
   - Static names get full compile-time validation with errors
   - Dynamic names get warnings about limited validation
   - Variable references produce warnings instead of errors when dynamic variables exist

4. **Test Results**: All 29 defineVariable tests now pass, including:
   - `defineVariable19`: Dynamic variable names from expressions
   - `dvParametersDontColide`: Variables in function parameters
   - All existing tests continue to work correctly

The implementation follows ADR-020 and maintains backward compatibility while adding the new capability for dynamic variable names as required by the FHIRPath specification.

## Success Criteria
- Test `[FHIRPath Lab] defineVariable19` passes
- Test `[FHIRPath Lab] dvParametersDontColide` passes  
- Static variable names continue to have full compile-time validation
- Dynamic variable names work at runtime with appropriate warnings

## Test Cases to Verify
- `defineVariable19`: Dynamic variable name from expression
- `dvParametersDontColide`: Variables in function parameters
- All other defineVariable tests continue to pass