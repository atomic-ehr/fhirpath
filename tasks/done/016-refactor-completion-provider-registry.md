# Task 016: Refactor Completion Provider to Use Registry for Type-Specific Functions

## Problem

The completion provider currently has hardcoded type-specific functions and types that duplicate information already available in the registry:

1. **Hardcoded type-specific functions** in `getTypeSpecificFunctions()`:
   - String functions: length, startsWith, endsWith, contains, substring, upper, lower, replace, matches, indexOf, split, trim
   - Math functions: abs, ceiling, floor, round, sqrt, ln, log, exp, power  
   - Date/Time functions: toDateTime, toTime, toString
   - Quantity functions: value, unit

2. **Hardcoded type lists**:
   - Primitive types: Boolean, String, Integer, Decimal, Date, DateTime, Time, Quantity
   - Complex types: Coding, CodeableConcept, Period, Range, Ratio, etc.

These functions are already registered in the registry with proper type signatures, creating duplication and maintenance burden.

## Solution

Extend the registry interface to provide type-aware queries and refactor the completion provider to use the registry as the single source of truth.

## Implementation Steps

### 1. Extend Registry Interface

Add new methods to `src/registry.ts`:

```typescript
class Registry {
  // Get functions applicable to a specific type
  getFunctionsForType(typeName: TypeName | string): FunctionDefinition[]
  
  // Get operators applicable to a specific type  
  getOperatorsForType(typeName: TypeName | string): OperatorDefinition[]
  
  // Check if a function is applicable to a type
  isFunctionApplicableToType(functionName: string, typeName: TypeName | string): boolean
  
  // Check if an operator is applicable to a type
  isOperatorApplicableToType(operatorSymbol: string, typeName: TypeName | string): boolean
}
```

Implementation details:
- Check `signature.input.type` for compatibility
- Handle 'Any' type (accepts all types)
- Consider singleton constraints
- Support type hierarchy and polymorphic functions

### 2. Update Completion Provider

In `src/completion-provider.ts`:

1. **Remove hardcoded function `getTypeSpecificFunctions()`** (lines 634-689)

2. **Update `getIdentifierCompletions()` to use registry**:
   - Replace call to `getTypeSpecificFunctions()`
   - Use `registry.getFunctionsForType(typeName)` instead
   - Leverage enhanced `isFunctionApplicable()` that uses registry

3. **Update `getOperatorCompletions()` to use enhanced registry**:
   - Use `registry.getOperatorsForType()` if available
   - Or enhance existing `isOperatorApplicable()` to use registry methods

4. **Consider getting type lists from registry or model provider**:
   - Instead of hardcoded primitiveTypes and complexTypes arrays
   - Could add `registry.getPrimitiveTypes()` and `registry.getComplexTypes()`
   - Or get from model provider for FHIR types

### 3. Add Tests

Create tests for new registry methods:
- Test type compatibility checking
- Test function filtering by type
- Test operator filtering by type
- Ensure completion provider still returns correct completions

### 4. Update Existing Operations (if needed)

Ensure all operations have proper type signatures in their definitions:
- Review operations in `src/operations/` 
- Ensure `signature.input.type` is properly set
- Add missing type constraints where needed

## Benefits

1. **Single Source of Truth**: Registry becomes the authoritative source for function/operator metadata
2. **Automatic Updates**: New functions added to registry automatically appear in completions
3. **Consistent Behavior**: Completion suggestions match actual runtime capabilities
4. **Reduced Maintenance**: No need to update completions when adding new functions
5. **Better Type Safety**: Type checking logic centralized in registry

## Files Affected

- `src/registry.ts` - Add new type-aware query methods
- `src/completion-provider.ts` - Remove hardcoded functions, use registry
- `src/types.ts` - May need to update Registry interface types
- `test/completion-provider.test.ts` - Update tests for new behavior
- `test/registry.test.ts` - Add tests for new registry methods

## Acceptance Criteria

- [x] All hardcoded type-specific functions removed from completion provider
- [x] Registry provides type-aware function/operator queries
- [x] Completion provider uses registry for all function/operator suggestions
- [x] All existing completion tests pass
- [x] New tests added for registry type-aware methods
- [x] No regression in completion functionality
- [ ] Documentation updated if needed

## Completed

### What was done:

1. **Extended Registry with type-aware methods** (`src/registry.ts`):
   - Added `getFunctionsForType(typeName)` - returns functions applicable to a type
   - Added `getOperatorsForType(typeName)` - returns operators applicable to a type
   - Added `isFunctionApplicableToType(functionName, typeName)` - checks function compatibility
   - Added `isOperatorApplicableToType(operatorSymbol, typeName)` - checks operator compatibility
   - Implemented type compatibility checking including numeric and temporal type groups

2. **Refactored completion provider** (`src/completion-provider.ts`):
   - Removed hardcoded `getTypeSpecificFunctions()` function (lines 634-689)
   - Updated `getIdentifierCompletions()` to use `registry.getFunctionsForType()`
   - Updated `isFunctionApplicable()` to use `registry.isFunctionApplicableToType()`
   - Updated `isOperatorApplicable()` to use `registry.isOperatorApplicableToType()`
   - Now uses registry as single source of truth for function/operator metadata

3. **Added comprehensive tests** (`test/registry-type-aware.test.ts`):
   - Tests for `getFunctionsForType()` with various types (String, Integer, Decimal, Date, etc.)
   - Tests for `getOperatorsForType()` with various types
   - Tests for `isFunctionApplicableToType()` including edge cases
   - Tests for `isOperatorApplicableToType()` including edge cases
   - All 20 tests passing

4. **Exported completion provider types** (`src/index.ts`):
   - `CompletionItem` and `CompletionOptions` interfaces are now properly exported
   - Enables external tools and integrations to use these types

### Benefits achieved:

- Eliminated code duplication between registry and completion provider
- Single source of truth for function/operator metadata
- Automatic inclusion of new functions in completions when added to registry
- Better maintainability and consistency
- Type checking logic centralized in registry

## Notes

- Consider performance implications of registry lookups during completion
- May want to cache results for frequently queried types
- Could extend this pattern to other parts of the codebase that need type-aware function information