# ADR-010: Equality Implementation Refactor

## Status
Proposed

## Context

The current FHIRPath equality implementation has evolved organically across multiple files and operators (`=` and `!=`). After a deep analysis of the codebase, several limitations and architectural issues have been identified that impact correctness, performance, and maintainability.

### Current State

The equality logic is distributed across:
- `src/operations/equal-operator.ts` - Main equality operator
- `src/operations/not-equal-operator.ts` - Inequality operator  
- `src/temporal.ts` - Temporal type equality
- `src/quantity-value.ts` - Quantity equality via UCUM

### Key Issues Identified

1. **Code Duplication**: Significant duplication between `=` and `!=` operators
2. **Incomplete Type Support**: Missing deep equality for complex FHIR types
3. **Temporal Type Bug**: The `!=` operator doesn't properly handle temporal types
4. **Performance**: Inefficient repeated conversions and comparisons
5. **Inconsistent Behavior**: Different equality semantics across type categories

## Decision

We will refactor the equality implementation to:

1. **Create a unified comparison system** that equality and comparison operators can leverage
2. **Implement proper type-specific equality** for all FHIRPath types
3. **Optimize performance** through caching and early-exit strategies
4. **Improve type safety** with a clear comparison result type system

**Note**: The equivalence operator (`~`) is explicitly **out of scope** for this refactor. While it may reuse some infrastructure for complex/collection traversal, it has fundamentally different semantics (whitespace normalization, case sensitivity, null vs empty handling) and should be implemented as a separate concern.

## Consequences

### Positive
- **Correctness**: Fix temporal type handling in `!=` operator
- **Performance**: Reduce redundant computations through caching
- **Maintainability**: Single source of truth for comparison logic
- **Type Safety**: Better compile-time guarantees
- **Code Reuse**: Shared infrastructure benefits all comparison operators

### Negative
- **Migration Effort**: Need to refactor existing operators
- **Testing**: Extensive test updates required
- **Complexity**: More sophisticated type system needed

Note: Breaking changes to internal APIs are acceptable and expected. This is not a negative as long as external behavior is preserved.

## Implementation Plan

### Phase 1: Core Comparison System

Create a new module `src/comparison.ts`:

```typescript
export type ComparisonResult = 
  | { kind: 'equal' }
  | { kind: 'less' }
  | { kind: 'greater' }
  | { kind: 'incomparable'; reason?: string };

export interface Comparable {
  compare(other: unknown): ComparisonResult;
}

export function compare(a: unknown, b: unknown): ComparisonResult {
  // Dispatch to type-specific comparisons
  if (isTemporalValue(a) && isTemporalValue(b)) {
    return compareTemporal(a, b);
  }
  if (isQuantity(a) && isQuantity(b)) {
    return compareQuantities(a, b);
  }
  if (isComplex(a) && isComplex(b)) {
    return compareComplex(a, b);
  }
  // ... other types
  return comparePrimitive(a, b);
}
```

### Phase 2: Type-Specific Implementations

#### Temporal Comparison
```typescript
function compareTemporal(a: TemporalValue, b: TemporalValue): ComparisonResult {
  // Handle timezone normalization efficiently
  // Cache UTC conversions
  // Use timestamp comparison where possible
}
```

#### Complex Type Comparison
```typescript
function compareComplex(a: any, b: any): ComparisonResult {
  // Deep structural comparison
  // Handle FHIR resources/elements
  // Consider property order independence
}
```

#### Quantity Comparison
```typescript
function compareQuantities(a: QuantityValue, b: QuantityValue): ComparisonResult {
  // Leverage UCUM with caching
  // Handle calendar durations
  // Optimize dimensionless quantities
}
```

### Phase 3: Operator Refactoring

Refactor existing operators to use the new system:

```typescript
// equal-operator.ts
export const evaluate: OperationEvaluator = async (input, context, left, right) => {
  const result = compareCollections(left, right);
  if (result.kind === 'incomparable') {
    return { value: [], context };
  }
  return { value: [box(result.kind === 'equal')], context };
};

// not-equal-operator.ts  
export const evaluate: OperationEvaluator = async (input, context, left, right) => {
  const result = compareCollections(left, right);
  if (result.kind === 'incomparable') {
    return { value: [], context };
  }
  return { value: [box(result.kind !== 'equal')], context };
};
```

### Phase 4: Performance Optimizations

1. **Caching Strategy**:
   - UTC conversion cache for temporal types
   - UCUM quantity conversion cache
   - Comparison result cache for repeated operations

2. **Early Exit Optimizations**:
   - Type mismatch detection
   - Length comparison for collections
   - Reference equality check

3. **Lazy Initialization**:
   - Defer UCUM quantity creation
   - On-demand temporal normalization

## Testing Strategy

### Testing Approach

We will follow a two-phase testing strategy:

1. **Phase 1: Unit Tests (TypeScript/JavaScript)**
   - Start with unit tests written in TypeScript using Bun test
   - Focus on isolated testing of the comparison logic
   - Test each type-specific comparison function independently
   - Easier debugging and faster feedback during development

2. **Phase 2: Integration Tests (JSON)**
   - Move to JSON-based test cases for broader coverage
   - Port equality tests from existing test suites:
     - **fhirpath.js test cases** (in `fhirpath.js/test/cases/*.yaml`)
       - Specifically: `6.1-equality.yaml`, `6.2-equivalence.yaml` (for edge cases)
       - Collection tests in `5.2-union.yaml`, `5.3-combine.yaml`
     - **Official FHIRPath XML test cases** from the specification
       - Focus on `testEqualityOperators.xml` and related files
   - Ensure compatibility with reference implementations
   
   **Note on test organization**: When porting tests, organize them by type rather than keeping them all in equality tests:
   - Date/DateTime/Time equality tests → `test-cases/operations/temporal/comparison.json`
   - Quantity equality tests → `test-cases/operations/quantity/comparison.json`
   - Collection equality tests → `test-cases/operations/collection/equality.json`
   - Basic type equality → `test-cases/operations/comparison/eq.json`
   
   This maintains better cohesion and makes tests easier to find and maintain.

### Test Coverage Areas

1. **Preserve existing test coverage** - All current tests must pass
2. **Add temporal inequality tests** - Specifically for the `!=` bug
3. **Deep equality test suite** - Complex FHIR resources
4. **Performance benchmarks** - Ensure optimizations work
5. **Cross-operator consistency** - Verify `=` and `!=` alignment
6. **Reference implementation compatibility** - Tests from fhirpath.js and XML specs

## Migration Path

**Important**: We do **NOT** need to maintain backward compatibility with the internal API. The refactor can introduce breaking changes to internal interfaces as long as:
- All existing tests pass (behavior is preserved)
- The public FHIRPath expression evaluation API remains stable
- Operator semantics match the FHIRPath specification

This freedom allows us to make more aggressive improvements to the internal architecture.

1. Implement new comparison system alongside existing code
2. Gradually migrate operators to use new system
3. Run parallel testing to ensure compatibility
4. Deprecate old implementations
5. Remove legacy code after validation period

## Alternatives Considered

### Alternative 1: Minimal Bug Fixes
Fix only the critical bugs (temporal `!=` operator) without broader refactoring.
- **Pros**: Lower risk, faster implementation
- **Cons**: Perpetuates technical debt, doesn't address core issues

### Alternative 2: External Library
Use an existing deep equality library (e.g., lodash.isEqual).
- **Pros**: Battle-tested code, less implementation effort
- **Cons**: Doesn't handle FHIRPath-specific semantics, dependency bloat

### Alternative 3: Type-Class Pattern
Implement comparison as type classes with instances for each type.
- **Pros**: Very type-safe, extensible
- **Cons**: More complex, may be over-engineering for this use case

## References

- [FHIRPath Specification - Equality](http://hl7.org/fhirpath/#equality)
- [UCUM Specification](https://ucum.org/ucum.html)

## Decision Outcome

**Chosen option**: Complete refactor with unified comparison system

This approach addresses all identified issues while providing a solid foundation for future enhancements. The phased implementation allows for incremental progress with validation at each step.