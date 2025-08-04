# Task 008: Implement Interpreter Type-Aware Execution

## Overview
Implement ADR-008 to make the interpreter type-aware by always running the analyzer before interpretation. This will enable better performance optimizations and proper implementation of type-aware operations.

## Requirements

### 1. Update Execution Pipeline
- Modify `evaluate()` function to always run analyzer before interpreter
- Parser → Analyzer → Interpreter pipeline
- Analyzer runs with or without ModelProvider
- Basic type analysis always available (primitives, collections)
- Enhanced analysis with ModelProvider (FHIR resources, navigations)

### 2. Type Operation Validation
Enforce that ALL type operations require ModelProvider:
- `ofType(Type)` - requires ModelProvider
- `is Type` - requires ModelProvider  
- `as Type` - requires ModelProvider

Add clear error messages explaining why ModelProvider is required (even for primitive types due to choice types).

### 3. Testing
- Add tests for execution with and without ModelProvider
- Test error messages for type operations without ModelProvider
- Test that analyzer is always called before interpreter

## Implementation Steps

1. [x] Update `src/index.ts` evaluate() to always run analyzer
2. [x] Add type operation validation in `src/analyzer.ts`
3. [x] Create tests for the new pipeline
4. [ ] Update documentation (not required for internal pipeline changes)

## Acceptance Criteria
- All FHIRPath expressions go through analyzer before interpreter
- Type operations fail with clear error when ModelProvider is missing
- Tests pass for both basic and enhanced type analysis scenarios
- No breaking changes to public API (only internal pipeline changes)

## Completion Summary

### What was done:

1. **Updated execution pipeline** - Modified `evaluate()` in `src/index.ts` to always run the analyzer before interpretation
   - Added `DiagnosticSeverity` import
   - Added `modelProvider` and `inputType` to `EvaluateOptions` interface
   - Analyzer runs with or without ModelProvider
   - Analysis errors are thrown before interpretation begins

2. **Added type operation validation** - Enhanced `src/analyzer.ts` to validate type operations
   - Added `MODEL_REQUIRED_FOR_TYPE_OPERATION` diagnostic code
   - Implemented `visitMembershipTest()` for 'is' operator validation
   - Implemented `visitTypeCast()` for 'as' operator validation
   - Added validation in `visitFunctionCall()` for 'ofType' function
   - All type operations now require ModelProvider with clear error messages

3. **Created comprehensive tests** - Added `test/pipeline.test.ts` with test suites for:
   - Pipeline execution (analyzer always runs)
   - Type operation validation (is, as, ofType)
   - Analysis error propagation
   - Basic and enhanced type analysis scenarios

4. **Verified compatibility** - All core tests pass (analyzer, interpreter, pipeline)
   - No breaking changes to public API
   - Internal pipeline changes are transparent to users

### Key insights:
- 'is' operator is parsed as `MembershipTest` node type
- 'as' operator is parsed as `TypeCast` node type  
- These required special handling in the analyzer visitor pattern
- The analyzer now provides fail-fast behavior for type operations without ModelProvider

### Result:
ADR-008 has been successfully implemented. The interpreter is now type-aware with the analyzer always running in the execution pipeline.