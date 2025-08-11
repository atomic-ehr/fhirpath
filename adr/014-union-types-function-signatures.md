# ADR-014: Union Types in Function Signatures

## Status

Proposed

## Context

The FHIRPath specification defines many functions that accept multiple types as input. For example:
- `abs()` accepts `Integer | Decimal | Quantity`
- `toInteger()` accepts `Integer | String | Boolean`
- `toString()` accepts multiple types including `String | Integer | Decimal | Boolean | Date | DateTime | Time | Quantity`

Currently, our `FunctionDefinition` interface only supports a single type signature:

```typescript
interface FunctionDefinition {
  signature: {
    input: TypeInfo;  // Can only specify one type
    parameters: Array<...>;
    result: TypeInfo | ...;
  };
}
```

This limitation forces us to use workarounds:
1. Using `Any` type - too permissive, shows functions in completions for inappropriate types
2. Runtime type checking only - no compile-time or completion-time type safety

Meanwhile, our `OperatorDefinition` already supports multiple signatures:

```typescript
interface OperatorDefinition {
  signatures: OperatorSignature[];  // Array of signatures
}
```

This inconsistency makes the codebase harder to understand and maintain.

## Decision

Extend `FunctionDefinition` to support multiple type signatures, mirroring the approach already used for operators.

### Changes:

1. **Create `FunctionSignature` interface**:
```typescript
export interface FunctionSignature {
  name: string;  // e.g., 'abs-integer', 'abs-decimal'
  input: TypeInfo;
  parameters: Array<{
    name: string;
    optional?: boolean;
    type: TypeInfo;
    expression?: boolean;
  }>;
  result: TypeInfo | 'inputType' | 'inputTypeSingleton' | 'parameterType';
}
```

2. **Update `FunctionDefinition`**:
```typescript
export interface FunctionDefinition {
  name: string;
  category: string[];
  description: string;
  examples: string[];
  signatures: FunctionSignature[];  // Changed from single to array
  evaluate: FunctionEvaluator;
}
```

3. **Update Registry**:
- Modify `isFunctionApplicableToType()` to check all signatures
- Return true if ANY signature matches the input type

4. **Update Functions**:
- Functions with single type wrap in array: `signatures: [{ ... }]`
- Functions with union types provide multiple signatures

### Example - `abs()` function:

```typescript
signatures: [
  {
    name: 'abs-integer',
    input: { type: 'Integer', singleton: true },
    parameters: [],
    result: { type: 'Integer', singleton: true }
  },
  {
    name: 'abs-decimal',
    input: { type: 'Decimal', singleton: true },
    parameters: [],
    result: { type: 'Decimal', singleton: true }
  },
  {
    name: 'abs-quantity',
    input: { type: 'Quantity', singleton: true },
    parameters: [],
    result: { type: 'Quantity', singleton: true }
  }
]
```

## Consequences

### Positive

- **Spec Compliance**: Accurately represents FHIRPath function signatures
- **Better Type Safety**: Functions only appear in completions for appropriate types
- **Consistency**: Functions and operators use the same signature pattern
- **Improved Completions**: `abs()` won't appear for String types, only for numeric types
- **Clearer Intent**: Explicit about which types each function accepts
- **Better Documentation**: Each signature can have its own descriptive name

### Negative

- **Breaking Change**: All existing functions must be updated
- **Migration Effort**: ~37 function definitions need modification
- **Increased Verbosity**: Simple functions need array wrapper
- **Complexity**: Code accessing signatures must handle arrays
- **Testing**: Need to update tests that access function signatures

## Alternatives Considered

### 1. Keep Using 'Any' Type
- **Pros**: No changes needed
- **Cons**: Too permissive, poor completion experience
- **Rejected**: Doesn't solve the core problem

### 2. Create Union Type Strings
- Example: `type: 'Integer|Decimal|Quantity'`
- **Pros**: Minimal interface changes
- **Cons**: Requires parsing, not type-safe, inconsistent with operators
- **Rejected**: Adds complexity without benefits

### 3. Backward Compatible Approach
- Support both `signature` and `signatures`
- **Pros**: Gradual migration possible
- **Cons**: Adds complexity, two ways to do same thing
- **Considered**: Could be used as migration strategy

### 4. Type Hierarchy System
- Create type groups like `Numeric` = `Integer | Decimal`
- **Pros**: Reusable type definitions
- **Cons**: Additional abstraction layer, doesn't handle all cases
- **Rejected**: Doesn't fully solve the problem

## Implementation Notes

1. The registry's type checking already handles numeric type groups (Integer, Decimal) and temporal type groups (Date, DateTime, Time) for compatibility checking.

2. The completion provider will need updates to handle the array of signatures when checking parameters.

3. Consider providing a migration script to automatically convert existing single signatures to array format.

4. This change aligns with how TypeScript itself handles function overloads through multiple signatures.

## References

- FHIRPath Specification: [Functions](http://hl7.org/fhirpath/#functions)
- Current operator implementation: `src/operations/plus-operator.ts`
- Registry type checking: `src/registry.ts`