# FHIRPath Design: Expression-Based Architecture

## Core Philosophy

FHIRPath is a path-based navigation and extraction language that operates on hierarchical data. Our implementation follows the specification's grammar structure to ensure correct semantics and operator precedence.

### Key Principles

1. **Everything is a collection** - Single values are treated as collections of one item
2. **Empty propagation** - Empty collections (`{}`) represent "no value" and propagate through operations
3. **Grammar-driven AST** - The AST structure mirrors the specification's grammar hierarchy
4. **Operator precedence** - Binary operators maintain their precedence as defined in the spec

## AST Structure

The AST follows the FHIRPath grammar's expression hierarchy:

```typescript
// Expression hierarchy (from lowest to highest precedence)
type Expression = 
  | OrExpression
  | AndExpression  
  | UnionExpression
  | EqualityExpression
  | InequalityExpression
  | MembershipExpression
  | TypeExpression
  | AdditiveExpression
  | MultiplicativeExpression
  | UnaryExpression
  | PostfixExpression
  | TermExpression;

// Binary expressions maintain operator precedence
interface BinaryExpression {
  type: 'binary';
  operator: '+' | '-' | '*' | '/' | 'div' | 'mod' | '=' | '!=' | '~' | '!~' | 
            '<' | '>' | '<=' | '>=' | 'in' | 'contains' | 'and' | 'or' | 
            'xor' | 'implies' | '|' | 'is' | 'as';
  left: Expression;
  right: Expression;
}

// Unary expressions
interface UnaryExpression {
  type: 'unary';
  operator: '+' | '-' | 'not';
  operand: Expression;
}

// Invocation expression (navigation and function calls)
interface InvocationExpression {
  type: 'invocation';
  expression: Expression;      // What we're invoking on
  invocation: Invocation;      // The invocation itself
}

type Invocation = 
  | MemberInvocation          // .name
  | FunctionInvocation        // .func(args)
  | IndexerInvocation;        // [index]

interface MemberInvocation {
  type: 'member';
  identifier: string;
}

interface FunctionInvocation {
  type: 'function';
  identifier: string;
  arguments: Expression[];
}

interface IndexerInvocation {
  type: 'indexer';
  index: Expression | number;  // Can be expression or integer
}

// Term expressions (leaves of the AST)
interface LiteralExpression {
  type: 'literal';
  value: any;
  dataType: 'boolean' | 'string' | 'integer' | 'decimal' | 
            'date' | 'dateTime' | 'time' | 'quantity';
}

interface IdentifierExpression {
  type: 'identifier';
  name: string;
}

interface ExternalConstantExpression {
  type: 'external';
  identifier: string;  // e.g., 'ucum', 'terminologies'
}

interface ThisExpression {
  type: 'this';
}

interface IndexExpression {
  type: 'index';
}

interface TotalExpression {
  type: 'total';
}

// Parenthesized expression
interface ParenthesizedExpression {
  type: 'parenthesized';
  expression: Expression;
}
```

## Expression Examples

### 1. Simple Navigation

```fhirpath
Patient.name.given
```

AST:
```typescript
{
  type: 'invocation',
  expression: {
    type: 'invocation',
    expression: {
      type: 'identifier',
      name: 'Patient'
    },
    invocation: {
      type: 'member',
      identifier: 'name'
    }
  },
  invocation: {
    type: 'member',
    identifier: 'given'
  }
}
```

### 2. Function Call with Predicate

```fhirpath
name.where(use = 'official')
```

AST:
```typescript
{
  type: 'invocation',
  expression: {
    type: 'identifier',
    name: 'name'
  },
  invocation: {
    type: 'function',
    identifier: 'where',
    arguments: [{
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
}
```

### 3. Binary Operators with Precedence

```fhirpath
age + 5 * 2
```

AST (multiplication has higher precedence):
```typescript
{
  type: 'binary',
  operator: '+',
  left: {
    type: 'identifier',
    name: 'age'
  },
  right: {
    type: 'binary',
    operator: '*',
    left: {
      type: 'literal',
      value: 5,
      dataType: 'integer'
    },
    right: {
      type: 'literal',
      value: 2,
      dataType: 'integer'
    }
  }
}
```

### 4. Union Operator

```fhirpath
Patient.name | Patient.contact.name
```

AST:
```typescript
{
  type: 'binary',
  operator: '|',
  left: {
    type: 'invocation',
    expression: {
      type: 'identifier',
      name: 'Patient'
    },
    invocation: {
      type: 'member',
      identifier: 'name'
    }
  },
  right: {
    type: 'invocation',
    expression: {
      type: 'invocation',
      expression: {
        type: 'identifier',
        name: 'Patient'
      },
      invocation: {
        type: 'member',
        identifier: 'contact'
      }
    },
    invocation: {
      type: 'member',
      identifier: 'name'
    }
  }
}
```

### 5. Type Expressions

```fhirpath
value is Integer and value as Integer > 0
```

AST:
```typescript
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

### 6. Indexer Expression

```fhirpath
name[0].given
```

AST:
```typescript
{
  type: 'invocation',
  expression: {
    type: 'invocation',
    expression: {
      type: 'identifier',
      name: 'name'
    },
    invocation: {
      type: 'indexer',
      index: 0
    }
  },
  invocation: {
    type: 'member',
    identifier: 'given'
  }
}
```

## Evaluation Semantics

### Collection-Based Evaluation

All operations work on collections:

```typescript
interface FHIRPathValue {
  items: any[];  // Always a collection (0 or more items)
  type?: TypeInfo;
}

// Empty collection
const empty: FHIRPathValue = { items: [] };

// Single value
const single: FHIRPathValue = { items: [42] };

// Multiple values
const multiple: FHIRPathValue = { items: [1, 2, 3] };
```

### Operator Evaluation

Binary operators follow these patterns:

1. **Singleton evaluation** - Most operators require singleton operands
2. **Empty propagation** - Empty operands usually result in empty
3. **Type checking** - Operators may perform implicit type conversions

```typescript
function evaluateBinary(op: string, left: FHIRPathValue, right: FHIRPathValue): FHIRPathValue {
  // Most operators work on singletons
  if (requiresSingletons(op)) {
    if (left.items.length !== 1 || right.items.length !== 1) {
      return empty;
    }
  }
  
  switch (op) {
    case '+':
      return add(left, right);
    case '=':
      return equals(left, right);
    case '|':
      return union(left, right);  // Special: works on collections
    // ... etc
  }
}
```

### Navigation and Invocation

Navigation distributes over collections:

```typescript
function evaluateMember(collection: FHIRPathValue, member: string): FHIRPathValue {
  const results = [];
  
  for (const item of collection.items) {
    if (item && typeof item === 'object' && member in item) {
      const value = item[member];
      if (Array.isArray(value)) {
        results.push(...value);
      } else if (value !== null && value !== undefined) {
        results.push(value);
      }
    }
  }
  
  return { items: results };
}
```

### Function Invocation

Functions operate on the collection they're invoked on:

```typescript
function evaluateFunction(
  collection: FHIRPathValue, 
  name: string, 
  args: Expression[],
  context: Context
): FHIRPathValue {
  switch (name) {
    case 'where':
      return where(collection, args[0], context);
    case 'select':
      return select(collection, args[0], context);
    case 'first':
      return first(collection);
    // ... etc
  }
}
```

## Type System

FHIRPath has a dual type system:

### System Types
- `Boolean`
- `String` 
- `Integer`
- `Decimal`
- `Date`
- `DateTime`
- `Time`
- `Quantity`

### Model Types
Context-specific types like `FHIR.Patient`, `FHIR.Observation`, etc.

### Type Checking

```typescript
interface TypeInfo {
  namespace?: string;  // e.g., 'FHIR', 'System'
  name: string;        // e.g., 'Patient', 'String'
  baseType?: TypeInfo; // For inheritance
}

function isType(value: FHIRPathValue, typeName: string): boolean {
  // Implementation checks both system and model types
}
```

## Special Variables

FHIRPath defines several special variables:

- `$this` - Current context item (in where/select/etc)
- `$index` - Current index in a collection operation
- `$total` - Total number of items in current collection

## External Constants

External constants provide access to external terminologies:

- `%ucum` - UCUM units
- `%terminologies` - Terminology services
- Custom constants defined by the implementation

## Error Handling

FHIRPath uses empty collection semantics for error handling:

1. **Type mismatches** often return empty
2. **Invalid operations** return empty
3. **Null propagation** through empty collections
4. Some operations may throw (implementation-defined)

## Implementation Considerations

### 1. Parser
The parser should follow the grammar structure closely to ensure correct precedence and associativity.

### 2. Evaluator
The evaluator should:
- Handle collection semantics uniformly
- Implement proper empty propagation
- Support all special variables
- Handle type checking appropriately

### 3. Optimization
Possible optimizations:
- Constant folding
- Common subexpression elimination
- Early termination for boolean operations
- Lazy evaluation for large collections

### 4. Extensions
The design allows for extensions:
- Custom functions
- Additional operators
- Model-specific navigation
- Performance hints

## Conclusion

This design aligns closely with the FHIRPath specification by:

1. **Following the grammar** - AST structure mirrors the expression hierarchy
2. **Preserving precedence** - Operators maintain their specified precedence
3. **Collection semantics** - Everything operates on collections
4. **Complete coverage** - All language features are represented
5. **Clear evaluation** - Semantics follow the specification

The expression-based AST provides a solid foundation for implementing FHIRPath with correct behavior and good performance characteristics.