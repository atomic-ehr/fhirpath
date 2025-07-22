# Task 018: Migrate All Functions from Interpreter to Global Registry

## Objective
Migrate all existing FHIRPath functions and their signatures from the interpreter's function system to the global registry, ensuring all functions use the unified Operation interface.

## Current State
- Some functions (exists, empty, count, first, last, single) are already in the registry
- Many functions still exist in the old interpreter/functions directory
- Old FunctionRegistry and signature system still in use for legacy functions

## Requirements

1. **Identify all functions to migrate**:
   - Scan `/src/interpreter/functions/*.ts` files
   - List all registered functions
   - Group by category (filtering, string, math, type, etc.)

2. **Create registry operations for each function**:
   - Convert function signatures to new Operation format
   - Implement proper analyze/evaluate/compile methods
   - Ensure proper parameter handling (value vs expression)
   - Handle propagatesEmpty correctly

3. **Function categories to migrate** (52 functions total):
   - **Core Control Flow** (4): iif, defineVariable, trace, check
   - **Existence Testing** (10): empty, exists, count, all, allTrue, anyTrue, allFalse, anyFalse, distinct, isDistinct
   - **Filtering** (4): where, select, ofType, repeat
   - **Subsetting** (6): first, last, tail, skip, take, single
   - **Combining** (4): union, combine, intersect, exclude
   - **Conversion** (5): toString, toInteger, toDecimal, toBoolean, toQuantity
   - **String** (13): contains, length, substring, startsWith, endsWith, upper, lower, indexOf, replace, split, join, trim, toChars
   - **Math** (3): abs, round, sqrt
   - **Type** (3): type, is, as
   - **Utility** (3): aggregate, children, descendants
   
   Note: Some functions in the registry already exist:
   - Already migrated: exists, empty, count, first, last, single

4. **Update imports and registrations**:
   - Register all functions in registry index
   - Remove old function registrations
   - Update any direct function imports

5. **Clean up old code**:
   - Remove `/src/interpreter/functions` directory
   - Remove old FunctionRegistry class
   - Remove ArgumentEvaluator if no longer needed
   - Remove old signature system types

## Implementation Plan

### Phase 1: Inventory
1. List all functions in interpreter/functions
2. Document their signatures and behavior
3. Identify any special handling requirements

### Phase 2: Implementation
1. Create new operation files in registry/operations:
   - `/src/registry/operations/filtering.ts` - where, select, ofType, repeat
   - `/src/registry/operations/string.ts` - 13 string functions
   - `/src/registry/operations/math.ts` - abs, round, sqrt
   - `/src/registry/operations/type-conversion.ts` - toString, toInteger, toDecimal, toBoolean, toQuantity
   - `/src/registry/operations/collection.ts` - union, combine, intersect, exclude
   - `/src/registry/operations/subsetting.ts` - UPDATE existing with tail, skip, take
   - `/src/registry/operations/aggregate.ts` - all, allTrue, anyTrue, allFalse, anyFalse, aggregate
   - `/src/registry/operations/utility.ts` - trace, check, defineVariable, iif, children, descendants
   - `/src/registry/operations/type-checking.ts` - type, is, as
   - `/src/registry/operations/existence.ts` - UPDATE existing with distinct, isDistinct

2. Implement each function following the pattern:
```typescript
export const whereFunction: Function = {
  name: 'where',
  kind: 'function',
  
  syntax: {
    notation: 'where(criteria)'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [
      {
        name: 'criteria',
        kind: 'expression',
        types: { kind: 'any' },
        cardinality: 'any',
        optional: false
      }
    ],
    output: {
      type: 'preserve-input',
      cardinality: 'collection'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input, ...args) => {
    // Implementation
  },
  
  compile: (compiler, input, args) => {
    // Compilation logic
  }
};
```

### Phase 3: Testing
1. Ensure all existing tests pass
2. Add tests for any missing coverage
3. Verify no regression in functionality

### Phase 4: Cleanup
1. Remove old function files
2. Remove FunctionRegistry
3. Update documentation

## Success Criteria
- All functions migrated to registry
- All interpreter tests passing
- No references to old function system
- Clean, consistent function implementations

## Dependencies
- Task 017 (interpreter migration) must be completed first
- Will enable full removal of old interpreter infrastructure

## Estimated Effort
- High - this touches many files and requires careful migration
- Each function needs analyze/evaluate/compile implementations
- Testing required for each migrated function