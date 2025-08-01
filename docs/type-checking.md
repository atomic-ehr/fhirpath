# FHIRPath Type Checking and Inference

## Overview

The FHIRPath analyzer now includes comprehensive type checking and inference capabilities. When a ModelProvider is supplied, the analyzer can:

1. **Infer types** from expressions and propagate them through the AST
2. **Check type compatibility** for operators and function arguments
3. **Report type errors** as diagnostics
4. **Support dynamic result types** for functions like `where()` and `select()`

## Type System

### Basic Types

FHIRPath supports the following primitive types:
- `String` - Text values
- `Integer` - Whole numbers
- `Decimal` - Numbers with decimal points
- `Boolean` - true/false values
- `Date` - Date values
- `DateTime` - Date and time values
- `Time` - Time values
- `Quantity` - Numeric values with units
- `Any` - Unknown or mixed types

### Collections vs Singletons

Each type can be either:
- **Singleton** (`singleton: true`) - A single value
- **Collection** (`singleton: false`) - Zero or more values

## Type Inference

The analyzer infers types for:

### Literals
```typescript
"hello"     // String (singleton)
42          // Integer (singleton)
3.14        // Decimal (singleton)
true        // Boolean (singleton)
```

### Variables
```typescript
$index      // Integer (singleton)
$total      // Integer (singleton)
$this       // Any (collection)
%userVar    // Inferred from provided value
```

### Operations
```typescript
5 + 3       // Integer (result of Integer + Integer)
"a" + "b"   // String (result of String + String)
(1 | 2)     // Integer[] (union creates collection)
```

### Functions
```typescript
where(...)  // Preserves input type as collection
select(...) // Type of projection expression as collection
length()    // Integer (singleton)
```

## Special Result Types

Some operations have dynamic result types:

### `inputType`
Functions like `where()` return the same type as their input:
```typescript
signature: {
  result: 'inputType'
}
```

### `parameterType`
Functions like `select()` return the type of their parameter expression:
```typescript
signature: {
  result: 'parameterType'
}
```

### `leftType` / `rightType`
Operators like union (`|`) preserve operand types:
```typescript
signature: {
  result: 'leftType'
}
```

## Type Checking

The analyzer performs type checking for:

### Binary Operators
```typescript
"hello" + 42  // Error: operator '+' cannot be applied to types String and Integer
5 + 3.14      // OK: Integer is compatible with Decimal
```

### Function Arguments
```typescript
"hello".substring("not a number")  // Error: argument 1 expects Integer but got String
"hello".substring(1, 2)            // OK
```

### Type Compatibility Rules

1. **Exact match**: Same type and cardinality
2. **Any type**: Compatible with everything
3. **Singleton to collection**: Automatic promotion
4. **Numeric compatibility**: Integer can be used where Decimal expected
5. **Subtyping**: Via ModelProvider (e.g., FHIR resource types)

## Usage

### Basic Type Checking
```typescript
import { analyze } from '@fhirpath/fhirpath';

const result = analyze('Patient.name.given + 42');
// result.diagnostics will contain type errors
```

### With Variables
```typescript
const result = analyze('%x + %y', {
  variables: { x: 5, y: "hello" }
});
// Type error: cannot add Integer and String
```

### With ModelProvider
```typescript
const result = analyze('Patient.name.given', {
  modelProvider: myFHIRProvider,
  inputType: { type: 'Any', namespace: 'FHIR', name: 'Patient' }
});
// Type inference through FHIR model
```

## Implementation Details

### Type Annotation
The analyzer annotates each AST node with a `typeInfo` property:
```typescript
interface ASTNode {
  typeInfo?: TypeInfo;
  // ... other properties
}
```

### Diagnostic Codes
Type errors use specific diagnostic codes:
- `TYPE_MISMATCH` - Incompatible types for operator
- `ARGUMENT_TYPE_MISMATCH` - Wrong type for function argument
- `UNKNOWN_OPERATOR` - Operator not found
- `UNKNOWN_FUNCTION` - Function not found

### Performance
Type checking adds minimal overhead:
- Type inference is done in a single AST traversal
- Type compatibility checks are O(1) for most cases
- ModelProvider calls are cached when possible