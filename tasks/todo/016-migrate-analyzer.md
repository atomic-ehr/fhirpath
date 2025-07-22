# Task 003: Migrate Analyzer to Use Registry

## Objective
Update the analyzer to use the unified registry for type checking and validation.

## Requirements

1. **Remove duplicate type signatures**:
   - Delete `function-signatures.ts`
   - Remove operator signature lookups
   - Use registry's operation signatures

2. **Update analysis methods**:
   - Use `operation.analyze()` for all operations
   - Remove switch statements for operators
   - Unify function and operator analysis

3. **Leverage operation metadata**:
   - Use `signature.parameters` for argument validation
   - Check cardinality constraints from signatures
   - Apply `propagatesEmpty` flag correctly

4. **Type inference**:
   - Use registry's type inference rules
   - Handle polymorphic operations via registry
   - Apply implicit conversions from registry

## Files to Update

- `/src/analyzer/analyzer.ts` - Main analyzer
- `/src/analyzer/function-signatures.ts` - Delete this file
- `/src/analyzer/types.ts` - Update if needed

## Key Changes

```typescript
// Before
const operatorSignature = this.getOperatorSignature(node.operator);

// After  
const operation = Registry.getByToken(node.operator);
return operation.analyze(this, input, [left, right]);
```

## Tests to Update

- Operator type checking tests
- Function signature validation tests
- Cardinality validation tests
- Error message tests

## Dependencies

- Tasks 001 and 002 must be completed first