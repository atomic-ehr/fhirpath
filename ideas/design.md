# FHIRPath Design: Simplified AST

## Core Philosophy

This design provides a minimal yet spec-compliant AST for FHIRPath. We reduce the node types while maintaining correct semantics and operator precedence through a unified approach.

### Key Principles

1. **Unified expression type** - All expressions share a common structure
2. **Operator precedence in parser** - Parser handles precedence, AST stores result
3. **Collection semantics** - Everything evaluates to collections
4. **Simple evaluation** - Straightforward recursive evaluation

## Simplified AST Structure

```typescript
// All expressions use this single type
interface Expression {
  type: ExpressionType;
  // Type-specific fields based on type
  [key: string]: any;
}

type ExpressionType = 
  | 'literal'      // 42, 'hello', true
  | 'identifier'   // Patient, name, $this
  | 'invocation'   // a.b, a.b(), a[0]
  | 'binary'       // a + b, a = b, a | b
  | 'unary'        // -a, not a
  | 'conditional'  // if(test, then, else)
  | 'list';        // (a, b, c)

// Literal values
interface LiteralExpression extends Expression {
  type: 'literal';
  value: any;
  dataType: 'boolean' | 'string' | 'integer' | 'decimal' | 
            'date' | 'dateTime' | 'time' | 'quantity' | 'null';
}

// Identifiers and special variables
interface IdentifierExpression extends Expression {
  type: 'identifier';
  name: string;  // 'Patient', '$this', '$index', '$total', '%ucum'
}

// All invocations: member access, function calls, indexers
interface InvocationExpression extends Expression {
  type: 'invocation';
  target: Expression;      // What we're invoking on
  kind: 'member' | 'function' | 'indexer';
  name?: string;           // For member/function
  args?: Expression[];     // For function/indexer
}

// Binary operators (precedence handled by parser)
interface BinaryExpression extends Expression {
  type: 'binary';
  operator: string;  // '+', '-', '=', 'and', 'or', '|', 'is', 'as', etc.
  left: Expression;
  right: Expression;
}

// Unary operators
interface UnaryExpression extends Expression {
  type: 'unary';
  operator: 'not' | '-' | '+';
  operand: Expression;
}

// Conditional (if-then-else)
interface ConditionalExpression extends Expression {
  type: 'conditional';
  condition: Expression;
  then: Expression;
  else?: Expression;
}

// List/tuple construction
interface ListExpression extends Expression {
  type: 'list';
  elements: Expression[];
}
```

## Expression Examples

### 1. Simple Navigation

```fhirpath
Patient.name.given
```

AST:
```javascript
{
  type: 'invocation',
  target: {
    type: 'invocation',
    target: {
      type: 'identifier',
      name: 'Patient'
    },
    kind: 'member',
    name: 'name'
  },
  kind: 'member',
  name: 'given'
}
```

### 2. Function Call

```fhirpath
name.where(use = 'official')
```

AST:
```javascript
{
  type: 'invocation',
  target: {
    type: 'identifier',
    name: 'name'
  },
  kind: 'function',
  name: 'where',
  args: [{
    type: 'binary',
    operator: '=',
    left: {
      type: 'identifier',
      name: 'use'
    },
    right: {
      type: 'literal',
      value: 'official',
      dataType: 'string'
    }
  }]
}
```

### 3. Mixed Operations

```fhirpath
Patient.age + 5 > 18 and Patient.active
```

AST:
```javascript
{
  type: 'binary',
  operator: 'and',
  left: {
    type: 'binary',
    operator: '>',
    left: {
      type: 'binary',
      operator: '+',
      left: {
        type: 'invocation',
        target: {
          type: 'identifier',
          name: 'Patient'
        },
        kind: 'member',
        name: 'age'
      },
      right: {
        type: 'literal',
        value: 5,
        dataType: 'integer'
      }
    },
    right: {
      type: 'literal',
      value: 18,
      dataType: 'integer'
    }
  },
  right: {
    type: 'invocation',
    target: {
      type: 'identifier',
      name: 'Patient'
    },
    kind: 'member',
    name: 'active'
  }
}
```

### 4. Indexer

```fhirpath
name[0].given
```

AST:
```javascript
{
  type: 'invocation',
  target: {
    type: 'invocation',
    target: {
      type: 'identifier',
      name: 'name'
    },
    kind: 'indexer',
    args: [{
      type: 'literal',
      value: 0,
      dataType: 'integer'
    }]
  },
  kind: 'member',
  name: 'given'
}
```

### 5. Type Operations

```fhirpath
value is Integer and value as Integer > 0
```

AST:
```javascript
{
  type: 'binary',
  operator: 'and',
  left: {
    type: 'binary',
    operator: 'is',
    left: {
      type: 'identifier',
      name: 'value'
    },
    right: {
      type: 'identifier',
      name: 'Integer'
    }
  },
  right: {
    type: 'binary',
    operator: '>',
    left: {
      type: 'binary',
      operator: 'as',
      left: {
        type: 'identifier',
        name: 'value'
      },
      right: {
        type: 'identifier',
        name: 'Integer'
      }
    },
    right: {
      type: 'literal',
      value: 0,
      dataType: 'integer'
    }
  }
}
```

## Evaluation Model

### Simple Recursive Evaluator

```typescript
type Value = any[];  // All values are collections

interface Context {
  root: Value;      // Original context
  current: Value;   // Current context ($this)
  index?: number;   // Current index ($index)
  total?: number;   // Total items ($total)
  variables: Map<string, Value>;
}

function evaluate(expr: Expression, ctx: Context): Value {
  switch (expr.type) {
    case 'literal':
      return expr.value === null ? [] : [expr.value];
    
    case 'identifier':
      return evaluateIdentifier(expr.name, ctx);
    
    case 'invocation':
      return evaluateInvocation(expr, ctx);
    
    case 'binary':
      return evaluateBinary(expr, ctx);
    
    case 'unary':
      return evaluateUnary(expr, ctx);
    
    case 'conditional':
      return evaluateConditional(expr, ctx);
    
    case 'list':
      return evaluateList(expr, ctx);
  }
}
```

### Invocation Evaluation

```typescript
function evaluateInvocation(expr: InvocationExpression, ctx: Context): Value {
  const target = evaluate(expr.target, ctx);
  
  switch (expr.kind) {
    case 'member':
      return navigateMember(target, expr.name!);
    
    case 'function':
      return callFunction(target, expr.name!, expr.args || [], ctx);
    
    case 'indexer':
      const index = evaluate(expr.args![0], ctx);
      return navigateIndex(target, index);
  }
}
```

### Binary Operator Evaluation

```typescript
function evaluateBinary(expr: BinaryExpression, ctx: Context): Value {
  // Special handling for operators that don't evaluate both sides first
  if (expr.operator === 'and' || expr.operator === 'or') {
    return evaluateLogical(expr, ctx);
  }
  
  const left = evaluate(expr.left, ctx);
  const right = evaluate(expr.right, ctx);
  
  // Operators like | work on collections
  if (expr.operator === '|') {
    return union(left, right);
  }
  
  // Most operators work on singletons
  if (left.length !== 1 || right.length !== 1) {
    return [];  // Empty collection
  }
  
  return evaluateOperator(expr.operator, left[0], right[0]);
}
```

## Operator Precedence Table

The parser handles precedence, but for reference:

```
Lowest to highest:
1. implies
2. or, xor
3. and
4. = != ~ !~
5. in contains
6. < > <= >= 
7. | (union)
8. is as
9. + - & (string concat)
10. * / div mod
11. unary: not - +
12. invocations: . () []
```

## Special Features

### 1. Polymorphic Operators

Some operators behave differently based on types:
- `+` : addition (numbers) or concatenation (strings)
- `=` : equality with special rules for collections
- `~` : equivalence (type-aware equality)

### 2. Collection Semantics

All operations propagate collections:
```typescript
[1, 2, 3] + 5        // [6, 7, 8]
[].where(...)        // []
[1, 2] = [1, 2]      // [true]
```

### 3. Null Handling

FHIRPath uses empty collections for null:
```typescript
null              // evaluates to []
{}.name           // evaluates to []
[] + 5            // evaluates to []
```

## Parser Considerations

The parser must:
1. Handle operator precedence correctly
2. Distinguish between types in context (e.g., `Integer` as type vs identifier)
3. Parse special forms like `$this`, `%ucum`
4. Handle optional parentheses and whitespace

## Benefits of This Design

1. **Simplicity**: Only 7 node types cover all of FHIRPath
2. **Uniformity**: Single Expression interface for all nodes
3. **Flexibility**: Easy to extend with new operators or functions
4. **Compliance**: Fully supports all FHIRPath features
5. **Performance**: Simple recursive evaluation, easy to optimize

## Implementation Notes

### Type Checking
```typescript
// Runtime type information
interface TypeInfo {
  name: string;       // 'Integer', 'Patient', etc.
  namespace?: string; // 'System', 'FHIR', etc.
}

// Values can carry type information
interface TypedValue {
  value: any;
  type?: TypeInfo;
}
```

### Error Handling
- Most errors return empty collection `[]`
- Parser errors throw exceptions
- Type errors during evaluation return `[]`
- Explicitly documented functions may throw

### Extension Points
- Custom functions: Add to function registry
- Custom operators: Extend parser and evaluator
- Type system: Add new types to type registry
- External constants: Register new `%` identifiers

## Conclusion

This simplified AST design provides:
- Complete FHIRPath support with minimal complexity
- Clear separation between parsing (precedence) and evaluation (semantics)
- Easy to understand and implement
- Efficient evaluation model
- Natural extension points

The design achieves spec compliance while keeping the implementation straightforward and maintainable.