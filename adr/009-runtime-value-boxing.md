# ADR-009: Runtime Value Boxing

## Status

Proposed

## Context

The current FHIRPath interpreter loses critical metadata during navigation and evaluation:

1. **Primitive Extensions Lost**: FHIR's `_propertyName` convention for primitive extensions (e.g., `_gender` containing extensions for `gender`) is inaccessible after navigation. The spec requires `Patient.gender.extension` to work, but our current implementation can't maintain this link.

2. **Type Information Lost**: When navigating properties (obtaining Union values, or invoking children()), we lose type information needed for operations like `ofType()`, and proper type casting.

Example that should work but doesn't:
```
Patient.gender.extension.where(url = 'http://example.org/gender-identity')
```

The problem is that once we extract the `'male'` string from `Patient.gender`, we've lost the connection to `Patient._gender` where the extensions live.

## Decision

Implement **universal runtime value boxing** where every value in the FHIRPath evaluation pipeline is wrapped with metadata:

```typescript
interface FHIRPathValue<T = any> {
  // The actual value
  value: T;
  
  // Type information from ModelProvider
  typeInfo?: TypeInfo;
  
  // Primitive element extension (for primitives only)
  primitiveElement?: {
    id?: string;
    extension?: Extension[];
  };
}
```

### Key Design Principles

1. **Everything is Boxed**: All values are boxed - literals, navigation results, operation outputs. No exceptions.

2. **Navigation is the Primary Boxer**: The dot operator and identifier evaluation box values with appropriate metadata from the source object.

3. **Operations Handle Boxing Transparently**:
   - Unwrap inputs when computing
   - Box outputs with appropriate type information
   - Preserve boxes when reorganizing collections

4. **Consistent Pipeline**: From initial input to final output, all intermediate values are boxed.

### Implementation Categories

**Unwrap → Compute → Box**
- String operations: `+`, `substring()`, `replace()`, `trim()`, `upper()`, `lower()`, `split()`
- Arithmetic: `+`, `-`, `*`, `/`, `div`, `mod`, `abs()`, `ceiling()`, `floor()`
- Comparisons: `=`, `!=`, `<`, `>`, `<=`, `>=` (box boolean results)
- Logical: `and`, `or`, `xor`, `implies`, `not()` (box boolean results)
- Tests: `exists()`, `empty()`, `startsWith()`, `contains()` (box boolean results)
- Conversions: `toString()`, `toInteger()`, `toDecimal()`, `toBoolean()`

**Expression-Based Operations** (handle lambda expressions)
- `where()`: Evaluate expression (returns boxed boolean), unwrap to test, preserve original item boxes
- `select()`: Expression evaluation returns boxed values
- `all()`, `any()`: Evaluate expression (returns boxed boolean), unwrap to test, box final result
- `iif()`: Unwrap condition result, return boxed branch result

**Pass-Through Operations** (preserve existing boxes)
- Collections: `union()`, `combine()`, `intersect()`, `exclude()`
- Positional: `first()`, `last()`, `tail()`, `take()`, `skip()`, `single()`
- `distinct()`, `trace()`

### Example: Primitive Extension Navigation

```typescript
// Patient resource
{
  resourceType: 'Patient',
  gender: 'male',
  _gender: {
    extension: [{
      url: 'http://example.org/gender-identity',
      valueString: 'non-binary'
    }]
  }
}

// Navigation: Patient.gender
// Returns: FHIRPathValue {
//   value: 'male',
//   typeInfo: { type: 'String', singleton: true },
//   primitiveElement: { extension: [...] }
// }

// Navigation: Patient.gender.extension
// The boxed value has primitiveElement, so we can navigate to it
// Returns: FHIRPathValue {
//   value: { url: '...', valueString: '...' },
//   typeInfo: { type: 'Extension', singleton: false }
// }
```

## Consequences

### Positive

- **Primitive Extensions Work**: Full support for FHIR's `_propertyName` convention
- **Type Operations Enabled**: `ofType()`, `children()`, and type filtering can work correctly
- **Consistent Model**: Every value has the same shape, simplifying the codebase
- **Better Debugging**: Type information available throughout evaluation
- **Future Extensibility**: Easy to add more metadata (source location, etc.)

### Negative

- **Performance Overhead**: Object allocation for every value (mitigated by modern JS engines)
- **Memory Usage**: Increased memory for metadata storage
- **Implementation Complexity**: All operations must be updated to handle boxing
- **Breaking Change**: Changes the internal evaluation model

### Migration Strategy

1. Implement boxing utilities and interface
2. Update navigation (dot operator) to box values
3. Gradually update operations by category
4. Ensure all paths produce boxed values
5. Remove any legacy unboxed code paths

## Alternatives Considered

### 1. Selective Boxing
Only box values that need metadata (primitives with extensions, complex types).
- **Pros**: Less overhead for simple values
- **Cons**: Complex logic to determine what needs boxing, inconsistent pipeline

### 2. Parallel Metadata Arrays
Maintain separate arrays for values and metadata.
- **Pros**: Potentially more memory efficient
- **Cons**: Complex to keep synchronized, error-prone

### 3. Lazy Boxing
Box values only when metadata is accessed.
- **Pros**: Performance optimization for simple cases
- **Cons**: Complex caching logic, unpredictable performance

### 4. Type-Only Boxing
Only box type information, handle primitive extensions differently.
- **Pros**: Simpler box structure
- **Cons**: Doesn't solve the primitive extension problem

The universal boxing approach was chosen for its simplicity, consistency, and complete solution to all metadata requirements.