# FHIRPath Interpreter Documentation

## Table of Contents
1. [Introduction](#introduction)
2. [Architecture Overview](#architecture-overview)
3. [Core Concepts](#core-concepts)
4. [Node Evaluation](#node-evaluation)
5. [Implementation Details](#implementation-details)
6. [Advanced Topics](#advanced-topics)
7. [Usage Examples](#usage-examples)
8. [Testing the Interpreter](#testing-the-interpreter)
9. [Extending the Interpreter](#extending-the-interpreter)
10. [Appendices](#appendices)

## Introduction

The FHIRPath interpreter is a TypeScript implementation that evaluates FHIRPath expressions following a stream-processing mental model. It transforms Abstract Syntax Trees (AST) produced by the parser into collections of values while maintaining evaluation context throughout the process.

### Key Design Principles

1. **Everything is a Collection**: All values in FHIRPath are collections, even single values are collections of one item
2. **Stream Processing**: Each node in the AST acts as a stream processor that transforms input and context
3. **Context Threading**: Context flows through expressions and can be modified by certain operations
4. **Empty Propagation**: Empty collections propagate through most operations
5. **Type Safety**: Strong type checking with support for both primitive and FHIR resource types

## Architecture Overview

### Core Components

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Parser    │────▶│     AST     │────▶│ Interpreter │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                          ┌────────────────────┼────────────────────┐
                          │                    │                    │
                    ┌─────▼─────┐       ┌──────▼──────┐     ┌──────▼──────┐
                    │  Context   │       │  Operators  │     │  Functions  │
                    │  Manager   │       │             │     │  Registry   │
                    └───────────┘       └─────────────┘     └─────────────┘
```

### Data Flow

Every expression evaluation follows this pattern:

```
           AST Node + Arguments
                    │
                    ▼
           ┌─────────────────┐
input   ──►│   Interpreter   │──► output (collection)
context ──►│    evaluate()   │──► new context
           └─────────────────┘
```

## Core Concepts

### 3.1 Stream-Processing Model

The interpreter treats every AST node as a stream processor that:
- Takes an input collection and context
- Processes them according to the node's semantics
- Returns an output collection and potentially modified context

This model allows for:
- Composable operations
- Consistent handling of collections
- Clear data flow through complex expressions

### 3.2 Context System

Context carries variables and environment data parallel to the data stream:

```typescript
interface Context {
  // User-defined variables (%varName)
  variables: Map<string, any[]>;
  
  // Special environment variables
  env: {
    $this?: any[];    // Current item in iterator functions
    $index?: number;  // Current index in iterator functions
    $total?: any[];   // Accumulator in aggregate function
  };
  
  // Root context variables
  $context?: any[];      // Original input to the expression
  $resource?: any[];     // Current resource being processed
  $rootResource?: any[]; // Top-level resource
}
```

#### Context Flow Rules
1. Context flows through expressions from left to right
2. Most operations pass context unchanged
3. Some operations (like `defineVariable`) create new context
4. Iterator functions set special variables in context

### 3.3 Type System

The interpreter includes a comprehensive type system that handles:

#### Primitive Types
- `Boolean`: true/false values
- `String`: text values
- `Integer`: whole numbers
- `Decimal`: decimal numbers
- `Date`: date values (YYYY-MM-DD)
- `DateTime`: date-time values with optional timezone
- `Time`: time values (HH:MM:SS)
- `Quantity`: numeric values with units

#### FHIR Resource Types
Any FHIR resource type (Patient, Observation, etc.) identified by the `resourceType` property.

#### Three-Valued Logic
FHIRPath uses three-valued logic where expressions can return:
- `true`: definitively true
- `false`: definitively false
- `empty`: unknown/undefined (represented as empty collection)

## Node Evaluation

### 4.1 Simple Nodes

#### Literals
Literals return their value wrapped in a collection:
```typescript
42        → [42]
'hello'   → ['hello']
true      → [true]
null      → []  // null becomes empty collection
```

#### Identifiers (Property Navigation)
Navigate properties on objects, with automatic flattening:
```typescript
// Input: [{name: {given: ['John', 'Jane']}}]
name      → [{given: ['John', 'Jane']}]
name.given → ['John', 'Jane']  // flattened
```

#### Variables
Access values from context:
```typescript
$this     → current item in iteration
$index    → current index in iteration
%myVar    → user-defined variable
%context  → original input to expression
```

### 4.2 Operators

#### Dot Operator (Pipeline)
The dot operator creates a pipeline where the output of the left expression becomes the input of the right:
```typescript
Patient.name.given
// Patient → name → given
```

#### Arithmetic Operators
Support standard arithmetic with singleton conversion:
```typescript
2 + 3     → [5]
5 - 2     → [3]
4 * 3     → [12]
10 / 2    → [5]
7 div 3   → [2]  // integer division
7 mod 3   → [1]  // modulo
```

#### Comparison Operators
Compare values with empty propagation:
```typescript
5 = 5     → [true]
5 != 3    → [true]
5 > 3     → [true]
5 < 3     → [false]
5 = {}    → []      // empty propagation
```

#### Logical Operators
Implement three-valued logic:
```typescript
true and true    → [true]
true and false   → [false]
true and {}      → []       // unknown
false and {}     → [false]  // false dominates
true or {}       → [true]   // true dominates
not true         → [false]
not {}           → []       // unknown
```

#### Membership Operators
Test collection membership:
```typescript
'a' in {'a', 'b', 'c'}      → [true]
{'a', 'b'} contains 'a'     → [true]
```

#### Type Operators
Check and cast types:
```typescript
'hello' is String           → [true]
42 is String               → [false]
resource as Patient        → [resource] or []
```

#### String Concatenation
Null-safe string concatenation:
```typescript
'Hello' & ' ' & 'World'    → ['Hello World']
'Hello' & {} & 'World'     → []  // empty if any part is empty
```

#### Union Operator
Combine collections preserving order and duplicates:
```typescript
{1, 2} | {2, 3} | {1}      → [1, 2, 2, 3, 1]
```

### 4.3 Functions

Functions are registered in a central registry with metadata about their behavior:

#### Function Categories

1. **Existence Functions**
   - `empty()`: Check if collection is empty
   - `exists([criteria])`: Check if collection has items
   - `count()`: Count items in collection
   - `all(criteria)`: Check if all items match

2. **Filtering and Projection**
   - `where(criteria)`: Filter by criteria
   - `select(projection)`: Transform each item
   - `repeat(projection)`: Recursively apply projection

3. **Subsetting**
   - `first()`, `last()`: Get first/last item
   - `tail()`: All but first
   - `skip(n)`, `take(n)`: Skip/take n items
   - `[index]`: Get item by index

4. **String Manipulation**
   - `contains(substring)`: Check for substring
   - `length()`: String length
   - `substring(start[, length])`: Extract substring
   - `upper()`, `lower()`: Case conversion
   - `replace(pattern, replacement)`: Replace text

5. **Type Conversion**
   - `toString()`, `toInteger()`, `toDecimal()`, `toBoolean()`
   - `convertsToX()`: Check if convertible

6. **Collection Operations**
   - `distinct()`: Remove duplicates
   - `union(other)`, `combine(other)`: Merge collections
   - `intersect(other)`, `exclude(other)`: Set operations

## Implementation Details

### 5.1 Evaluation Flow

The main evaluation method dispatches to specific handlers based on node type:

```typescript
evaluate(node: ASTNode, input: any[], context: Context): EvaluationResult {
  switch (node.type) {
    case NodeType.Literal:
      return this.evaluateLiteral(node, input, context);
    case NodeType.Identifier:
      return this.evaluateIdentifier(node, input, context);
    case NodeType.Binary:
      return this.evaluateBinary(node, input, context);
    // ... other node types
  }
}
```

### 5.2 Context Threading

Context flows through expressions with specific rules:

1. **Binary operators** (except dot): Evaluate left, thread context to right
   ```typescript
   // a + b
   leftResult = evaluate(left, input, context)
   rightResult = evaluate(right, input, leftResult.context)
   ```

2. **Dot operator**: Pipeline with context threading
   ```typescript
   // a.b
   leftResult = evaluate(left, input, context)
   rightResult = evaluate(right, leftResult.value, leftResult.context)
   ```

3. **Iterator functions**: Set $this and $index
   ```typescript
   // where(criteria)
   for (item of input) {
     iterContext = setIteratorContext(context, item, index)
     result = evaluate(criteria, [item], iterContext)
   }
   ```

### 5.3 Collection Utilities

#### Singleton Conversion
Many operators require single values and apply singleton conversion:
```typescript
[42] → 42        // single item collection to value
[1, 2, 3] → error // multiple items cannot convert
[] → empty        // empty remains empty
```

#### Empty Propagation
Most operations propagate empty collections:
```typescript
{} + 5 → {}
{}.length() → {}
```

## Advanced Topics

### 6.1 Function Argument Processing

Functions can control how their arguments are evaluated:

#### Pre-evaluated Arguments (default)
Arguments are evaluated before the function receives them:
```typescript
substring(0, length() - 2)
// length() - 2 is evaluated first, then passed to substring
```

#### Non-evaluated Arguments (lambdas)
Arguments are passed as AST nodes for the function to evaluate:
```typescript
where(use = 'official')
// The expression 'use = official' is passed as AST
```

#### $this Context in Arguments
When evaluating function arguments, the current `$this` is used as input:
```typescript
'string'.substring(0, length() - 2)
// When evaluating length() - 2, $this is ['string']
```

### 6.2 Iterator Functions

Iterator functions process collections item by item:

```typescript
// where() implementation
for (let i = 0; i < input.length; i++) {
  const item = input[i];
  // Set $this and $index for the criteria
  const iterContext = ContextManager.setIteratorContext(context, item, i);
  
  // Evaluate criteria with item as input and $this
  const result = interpreter.evaluate(criteria, [item], iterContext);
  
  if (isTruthy(result)) {
    results.push(item);
  }
}
```

### 6.3 Type Operations

Type checking and casting follow specific rules:

#### Type Checking
```typescript
TypeSystem.isType(value, typeName):
  - For primitives: Check JavaScript type and format
  - For resources: Check resourceType property
  - For complex types: Check structure
```

#### Type Casting
```typescript
TypeSystem.cast(value, typeName):
  - Return value if already correct type
  - Attempt conversion if possible
  - Return null if conversion fails
```

## Usage Examples

### 7.1 Basic Usage

```typescript
import { evaluateFHIRPath } from '@atomic-ehr/fhirpath';

// Simple navigation
const patient = { name: [{ given: ['John'], family: 'Doe' }] };
const result = evaluateFHIRPath("name.given", patient);
// Result: ['John']

// With filtering
const result2 = evaluateFHIRPath("name.where(use = 'official')", bundle);
```

### 7.2 With Context

```typescript
import { ContextManager } from '@atomic-ehr/fhirpath';

// Create context with variables
const context = ContextManager.create();
const ctxWithVar = ContextManager.setVariable(context, 'searchName', ['John']);

// Use variable in expression
const result = evaluateFHIRPath(
  "entry.resource.where(name.given contains %searchName)",
  bundle,
  ctxWithVar
);
```

### 7.3 Complex Expressions

```typescript
// Type filtering and transformation
evaluateFHIRPath(
  "Bundle.entry.resource.ofType(Patient).where(active = true).name.given",
  bundle
);

// String manipulation
evaluateFHIRPath(
  "name.given.first() & ' ' & name.family",
  patient
);

// Conditional logic
evaluateFHIRPath(
  "iif(gender = 'male', 'Mr. ', 'Ms. ') & name.given.first()",
  patient
);
```

## Testing the Interpreter

### Test Structure

Tests are organized by feature:
- `interpreter.test.ts`: Core functionality
- `interpreter.manual.test.ts`: $this context handling
- Parser tests verify AST generation
- Integration tests check end-to-end behavior

### Key Test Scenarios

1. **Collection semantics**: Empty propagation, flattening
2. **Context threading**: Variable access, context updates
3. **Type operations**: Type checking, casting
4. **Iterator functions**: $this and $index handling
5. **Edge cases**: Empty collections, type mismatches

### Performance Considerations

- Avoid unnecessary collection copies
- Cache frequently accessed values
- Use efficient data structures for large collections
- Profile complex expressions for bottlenecks

## Extending the Interpreter

### Adding New Functions

Register a new function with the FunctionRegistry:

```typescript
FunctionRegistry.register({
  name: 'myFunction',
  arity: 1,  // or { min: 1, max: 2 } for variable arity
  evaluateArgs: true,  // false for lambda arguments
  evaluate: (interpreter, args, input, context) => {
    // Implementation
    return { value: result, context };
  }
});
```

### Custom Operators

Add new operators by:
1. Adding token type to lexer
2. Updating parser precedence
3. Adding evaluation logic to interpreter

### Type System Extensions

Extend the type system:
```typescript
class CustomTypeSystem extends TypeSystem {
  static isType(value: any, typeName: string): boolean {
    if (typeName === 'MyCustomType') {
      return value.customTypeMarker === true;
    }
    return super.isType(value, typeName);
  }
}
```

## Appendices

### Complete Function Reference

See [Function Reference](./function-reference.md) for detailed documentation of all built-in functions.

### Operator Precedence Table

| Precedence | Operators | Description |
|------------|-----------|-------------|
| 1 (highest) | `.` | Navigation |
| 2 | `[]` | Indexing |
| 3 | unary `+`, `-`, `not` | Unary operators |
| 4 | `*`, `/`, `div`, `mod` | Multiplication |
| 5 | `+`, `-`, `&` | Addition, concatenation |
| 6 | `is`, `as` | Type operators |
| 7 | `<`, `>`, `<=`, `>=` | Comparison |
| 8 | `=`, `!=`, `~`, `!~` | Equality |
| 9 | `in`, `contains` | Membership |
| 10 | `and` | Logical AND |
| 11 | `or`, `xor` | Logical OR |
| 12 | `implies` | Implication |
| 13 (lowest) | `\|` | Union |

### Error Reference

Common errors and their meanings:

| Error | Description | Example |
|-------|-------------|---------|
| `Unknown function` | Function not registered | `foo()` where foo is undefined |
| `Type mismatch` | Operation on incompatible types | `'hello' + 5` |
| `Index out of bounds` | Invalid collection index | `[1,2][5]` |
| `Invalid argument count` | Wrong number of arguments | `substring('hello')` |
| `Singleton required` | Multiple values where one expected | `[1,2,3] + 5` |

---

This documentation provides a comprehensive guide to understanding and using the FHIRPath interpreter. For specific implementation details, refer to the source code in the `src/interpreter` directory.