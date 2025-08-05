# Task 009: Implement Type-Aware Execution (ADR-008)

## Overview
Implement the type-aware execution pipeline as specified in ADR-008, where the analyzer always runs before the interpreter to provide type information for better runtime behavior, optimizations, and proper implementation of type operations.

## Execution Plan

### Phase 1: Update Core Pipeline
1. **Modify evaluate() function in index.ts**
   - Always run analyzer before interpreter
   - Pass analyzed AST (with typeInfo) to interpreter
   - Ensure backward compatibility with existing API

2. **Update Interpreter to accept analyzed AST**
   - Ensure interpreter can handle AST nodes with typeInfo
   - Add helper methods to access typeInfo from nodes
   - Maintain existing behavior when typeInfo is basic (no ModelProvider)

### Phase 2: Implement Type Operation Validation
1. **Add type operation detection in Analyzer**
   - Detect ofType(), is, and as operations
   - Add validation that requires ModelProvider for ALL type operations
   - Generate clear error messages explaining why ModelProvider is needed

2. **Create diagnostic for missing ModelProvider**
   - Error code: MODEL_REQUIRED_FOR_TYPE_OPERATION
   - Include examples of why even primitive types need ModelProvider
   - Reference choice types (e.g., deceasedBoolean) in error message

### Phase 3: Implement Type Operations
1. **Implement ofType() function in interpreter**
   - Create new ofType-function.ts in operations/type/
   - Register in operations/index.ts
   - Use typeInfo from analyzed AST when available
   - Handle union/choice types when ModelProvider is available
   - Implement basic filtering when no ModelProvider

2. **Implement is operator**
   - Create is-operator.ts if not exists
   - Leverage typeInfo for type checking
   - Handle choice types correctly with ModelProvider

3. **Implement as operator**
   - Create as-operator.ts if not exists
   - Use typeInfo for safe casting
   - Provide better error messages with type context

### Phase 4: Add Type-Aware Optimizations
1. **Navigation optimization**
   - Skip impossible navigations based on type info
   - Optimize property access when types are known

2. **Collection operation optimization**
   - Use type info to optimize where(), select(), etc.
   - Skip type-incompatible operations early

### Phase 5: Testing and Validation
1. **Update existing tests**
   - Ensure all tests pass with new pipeline
   - Add ModelProvider where needed for type operations

2. **Add new test cases**
   - Test type operations with and without ModelProvider
   - Test error messages for missing ModelProvider
   - Test optimization behaviors

3. **Performance benchmarking**
   - Measure impact of always running analyzer
   - Verify optimizations provide benefit

## Implementation Order
1. Phase 1: Core pipeline changes (critical path)
2. Phase 2: Type operation validation (prevents silent failures)
3. Phase 3: Implement type operations (core functionality)
4. Phase 4: Optimizations (performance benefits)
5. Phase 5: Testing (validation and quality)

## Key Files to Modify/Create
- `src/index.ts` - Update evaluate() to always run analyzer
- `src/analyzer.ts` - Add type operation validation
- `src/interpreter.ts` - Handle analyzed AST with typeInfo
- `src/operations/type/ofType-function.ts` - CREATE: Implement ofType
- `src/operations/type/is-operator.ts` - CREATE/UPDATE: Implement is
- `src/operations/type/as-operator.ts` - CREATE/UPDATE: Implement as
- `src/operations/index.ts` - Register new type operations

## Success Criteria
1. All expressions go through analyzer → interpreter pipeline
2. Type operations require ModelProvider and fail fast without it
3. Type operations work correctly with choice types when ModelProvider is present
4. Performance is not significantly degraded for simple expressions
5. All existing tests pass with minimal modifications
6. Clear error messages guide users to provide ModelProvider when needed

## Notes
- This is a breaking change in the execution pipeline
- Focus on maintaining backward compatibility at the API level
- Ensure clear migration path for users
- Document the benefits of providing ModelProvider
- ofType, is, and as operations need to be implemented from scratch in the interpreter

## Implementation Summary (Completed)

### Phase 1: Updated Core Pipeline ✓
- Modified `evaluate()` function in index.ts to always run analyzer before interpreter
- Updated `EvaluateOptions` interface to include `modelProvider` and `inputType` 
- Added `currentNode` to `RuntimeContext` to provide access to AST node with typeInfo
- Interpreter now passes current node through context for all evaluations

### Phase 2: Implemented Type Operation Validation ✓
- Added `ModelRequiredForTypeOperation` diagnostic code
- Added validation in analyzer for ofType function calls
- Added validation for is/as operators (handled as MembershipTest and TypeCast nodes)
- Created comprehensive error messages explaining why ModelProvider is needed
- Added tests to verify validation works correctly

### Phase 3: Implemented Type Operations ✓
- Created `ofType-function.ts` with basic and type-aware filtering
- Updated `evaluateMembershipTest` for is operator with type-aware logic
- Updated `evaluateTypeCast` for as operator with type-aware filtering
- All operations handle TypeOrIdentifier nodes from parser
- Basic type checking works without ModelProvider (with limitations)
- Enhanced type checking available with ModelProvider

### Phase 4: Type-Aware Optimizations (Deferred)
- Basic optimizations included in type operations
- Further optimizations can be added incrementally

### Phase 5: Testing and Validation ✓
- All existing tests pass without modification
- Added comprehensive type operation tests
- Added validation tests for ModelProvider requirements
- Performance remains consistent

### Key Achievements
1. Pipeline always runs analyzer → interpreter
2. Type operations validate ModelProvider requirement 
3. Basic type operations work without ModelProvider
4. Enhanced type operations ready for ModelProvider integration
5. Full backward compatibility maintained
6. Clear error messages guide users