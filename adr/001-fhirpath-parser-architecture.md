# ADR-001: FHIRPath Parser Architecture

## Status

Proposed

## Context

We need to implement a FHIRPath parser in TypeScript that:
- Is fast and efficient for runtime evaluation
- Provides clear error messages with accurate position information
- Has a clean AST structure that's easy to work with
- Is maintainable and extensible
- Can be easily tested

FHIRPath is a path-based expression language with:
- Complex precedence rules (14 levels of operator precedence)
- Both prefix and infix operators
- Fluent method chaining syntax
- Multiple literal types (strings, numbers, dates, quantities)
- Context-sensitive lexing (e.g., keywords can be identifiers in some contexts)

## Decision

We will implement a **hand-written recursive descent parser** with the following architecture:

### 1. Lexer/Tokenizer
- Separate tokenization phase for better error reporting
- Token structure includes position information (line, column, offset)
- Lazy tokenization for performance
- Token types aligned with the grammar specification

### 2. Parser
- Recursive descent with precedence climbing for expression parsing
- Predictive parsing where possible (LL(1) for most constructs)
- Explicit error recovery points for better error messages

### 3. AST Structure

```typescript
interface Position {
  line: number;
  column: number;
  offset: number;
}

interface Range {
  start: Position;
  end: Position;
}

interface ASTNode {
  type: string;
  range?: Range;  // All nodes include position information
}

// Expression nodes
interface Expression extends ASTNode {
  type: 'Expression';
}

interface BinaryExpression extends Expression {
  type: 'BinaryExpression';
  operator: BinaryOperator;
  left: Expression;
  right: Expression;
}

interface UnaryExpression extends Expression {
  type: 'UnaryExpression';
  operator: UnaryOperator;
  operand: Expression;
}

// OPTION 1: Keep separate (current design)
interface MemberExpression extends Expression {
  type: 'MemberExpression';
  object: Expression;
  property: Identifier;
}

interface InvocationExpression extends Expression {
  type: 'InvocationExpression';
  object: Expression;
  invocation: MethodInvocation | Identifier;
}

// OPTION 2: Merge into unified DotExpression
interface DotExpression extends Expression {
  type: 'DotExpression';
  object: Expression;
  member: Identifier | MethodInvocation | SpecialInvocation | IifExpression;
}

// Analysis: We CANNOT safely merge them because:
// 1. Type safety: property access vs method invocation have different semantics
// 2. Evaluation: properties are looked up, methods are called
// 3. AST clarity: distinguishes between Patient.name (data access) vs Patient.exists() (computation)
// 4. The 'invocation' field accepts more than just Identifier (MethodInvocation, etc.)
// Decision: Keep them separate for semantic clarity

interface CallExpression extends Expression {
  type: 'CallExpression';
  callee: Expression;
  arguments: Expression[];
}

interface MethodInvocation extends Expression {
  type: 'MethodInvocation';
  name: string;
  arguments: Expression[];
}

interface IndexExpression extends Expression {
  type: 'IndexExpression';
  object: Expression;
  index: Expression;
}

// Literals
interface Literal extends Expression {
  type: 'Literal';
  value: any;
  raw: string;
}

interface StringLiteral extends Literal {
  type: 'StringLiteral';
  value: string;
}

interface NumberLiteral extends Literal {
  type: 'NumberLiteral';
  value: number;
}

interface BooleanLiteral extends Literal {
  type: 'BooleanLiteral';
  value: boolean;
}

interface DateTimeLiteral extends Literal {
  type: 'DateTimeLiteral';
  value: Date;
  precision: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond';
}

interface QuantityLiteral extends Literal {
  type: 'QuantityLiteral';
  value: number;
  unit: string;
}

interface Identifier extends Expression {
  type: 'Identifier';
  name: string;
}

interface ExternalConstant extends Expression {
  type: 'ExternalConstant';
  name: string;
}

interface SpecialInvocation extends Expression {
  type: 'SpecialInvocation';
  name: '$this' | '$index' | '$total';
  isImplicit?: boolean;  // true when parser inserted it, false/undefined when user wrote it
}

interface EmptyCollectionLiteral extends Expression {
  type: 'EmptyCollectionLiteral';
}

interface StandaloneFunctionCall extends Expression {
  type: 'StandaloneFunctionCall';
  name: 'today' | 'now' | 'timeOfDay';
  arguments: Expression[];  // Always empty for these functions
}

interface EnvironmentVariable extends Expression {
  type: 'EnvironmentVariable';
  name: string;
}

interface IifExpression extends Expression {
  type: 'IifExpression';
  condition: Expression;
  thenBranch: Expression;
  elseBranch?: Expression;  // Optional, defaults to empty collection
}
```

### 4. Error Handling
- Custom error class with position information
- Error recovery at statement boundaries
- Synchronization tokens for error recovery
- Detailed error messages with context

```typescript
class FHIRPathSyntaxError extends Error {
  constructor(
    message: string,
    public range: Range,
    public expected?: string[],
    public found?: string
  ) {
    super(message);
  }
}
```

### 5. Parser Implementation Structure

```typescript
class FHIRPathParser {
  private tokens: Token[];
  private current: number = 0;
  private lambdaDepth: number = 0;  // Track lambda context depth
  
  private readonly STANDALONE_FUNCTIONS = new Set([
    'today', 'now', 'timeOfDay'
  ]);
  
  private readonly LAMBDA_FUNCTIONS = new Set([
    'where', 'select', 'all', 'exists', 'repeat', 'aggregate'
  ]);

  parse(input: string): Expression {
    this.tokens = tokenize(input);
    return this.expression();
  }

  private expression(): Expression {
    return this.impliesExpression();
  }

  private impliesExpression(): Expression {
    let expr = this.orExpression();
    while (this.match('implies')) {
      const operator = this.previous();
      const right = this.orExpression();
      expr = new BinaryExpression(expr, operator, right);
    }
    return expr;
  }

  // Primary expression parsing with implicit $this
  private parsePrimaryExpression(): Expression {
    // Handle root identifiers - ALL get implicit $this
    if (this.match(IDENTIFIER)) {
      const name = this.previous();
      
      // Special handling for standalone functions
      if (this.peek()?.type === '(' && this.STANDALONE_FUNCTIONS.has(name.value)) {
        return this.parseStandaloneFunctionCall(name);
      }
      
      // Special handling for iif
      if (name.value === 'iif' && this.peek()?.type === '(') {
        const iifExpr = this.parseIifExpression();
        // Wrap in implicit $this for consistency
        return {
          type: 'InvocationExpression',
          object: {
            type: 'SpecialInvocation',
            name: '$this',
            isImplicit: true
          },
          invocation: iifExpr
        };
      }
      
      // Bare function calls get implicit $this
      if (this.peek()?.type === '(') {
        return {
          type: 'InvocationExpression',
          object: {
            type: 'SpecialInvocation',
            name: '$this',
            isImplicit: true
          },
          invocation: {
            type: 'MethodInvocation',
            name: name.value,
            arguments: this.parseArguments()
          }
        };
      }
      
      // Inside lambda context, bare identifiers get implicit $this
      if (this.lambdaDepth > 0 && !name.value.startsWith('$')) {
        return {
          type: 'MemberExpression',
          object: {
            type: 'SpecialInvocation',
            name: '$this',
            isImplicit: true
          },
          property: {
            type: 'Identifier',
            name: name.value
          }
        };
      }
      
      // At root level, all identifiers get implicit $this
      return {
        type: 'MemberExpression',
        object: {
          type: 'SpecialInvocation',
          name: '$this',
          isImplicit: true
        },
        property: {
          type: 'Identifier',
          name: name.value
        }
      };
    }
    
    // Handle other primary expressions...
  }
  
  // Track lambda context when parsing method arguments
  private parseMethodInvocation(name: string): MethodInvocation {
    const isLambda = this.LAMBDA_FUNCTIONS.has(name);
    if (isLambda) this.lambdaDepth++;
    
    const args = this.parseArguments();
    
    if (isLambda) this.lambdaDepth--;
    
    return {
      type: 'MethodInvocation',
      name,
      arguments: args
    };
  }

  // ... other precedence levels
}
```

### 6. Example Parse Trees

#### Simple Path Navigation

For the expression: `Patient.name.given`

```typescript
{
  type: 'MemberExpression',
  object: {
    type: 'MemberExpression',
    object: {
      type: 'MemberExpression',
      object: {
        type: 'SpecialInvocation',
        name: '$this',
        isImplicit: true  // Parser added this automatically
      },
      property: {
        type: 'Identifier',
        name: 'Patient'
      }
    },
    property: {
      type: 'Identifier',
      name: 'name'
    }
  },
  property: {
    type: 'Identifier',
    name: 'given'
  }
}
```

This shows how simple property navigation is represented as nested `MemberExpression` nodes with implicit `$this` at the root. Note: Position information (range properties) are omitted from all examples for clarity but would be present in the actual AST.

#### Complex Expression with Method Calls

For the expression:
```
Patient.name.where(use = 'official').given | Patient.contact.name.where(use = 'official').given
```

The resulting AST would be:

```typescript
{
  type: 'BinaryExpression',
  operator: '|',
  left: {
    type: 'MemberExpression',
    object: {
      type: 'InvocationExpression',
      object: {
        type: 'MemberExpression',
        object: {
          type: 'MemberExpression',
          object: {
            type: 'SpecialInvocation',
            name: '$this',
            isImplicit: true
          },
          property: {
            type: 'Identifier',
            name: 'Patient'
          }
        },
        property: {
          type: 'Identifier',
          name: 'name'
        }
      },
      invocation: {
        type: 'MethodInvocation',
        name: 'where',
        arguments: [{
          type: 'BinaryExpression',
          operator: '=',
          left: {
            type: 'MemberExpression',
            object: {
              type: 'SpecialInvocation',
              name: '$this',
              isImplicit: true  // Inside where() lambda context
            },
            property: {
              type: 'Identifier',
              name: 'use'
            }
          },
          right: {
            type: 'StringLiteral',
            value: 'official',
            raw: "'official'"
          }
        }]
      }
    },
    property: {
      type: 'Identifier',
      name: 'given'
    }
  },
  right: {
    type: 'MemberExpression',
    object: {
      type: 'InvocationExpression',
      object: {
        type: 'MemberExpression',
        object: {
          type: 'MemberExpression',
          object: {
            type: 'MemberExpression',
            object: {
              type: 'SpecialInvocation',
              name: '$this',
              isImplicit: true
            },
            property: {
              type: 'Identifier',
              name: 'Patient'
            }
          },
          property: {
            type: 'Identifier',
            name: 'contact'
          }
        },
        property: {
          type: 'Identifier',
          name: 'name'
        }
      },
      invocation: {
        type: 'MethodInvocation',
        name: 'where',
        arguments: [{
          type: 'BinaryExpression',
          operator: '=',
          left: {
            type: 'MemberExpression',
            object: {
              type: 'SpecialInvocation',
              name: '$this',
              isImplicit: true  // Inside where() lambda context
            },
            property: {
              type: 'Identifier',
              name: 'use'
            }
          },
          right: {
            type: 'StringLiteral',
            value: 'official',
            raw: "'official'"
          }
        }]
      }
    },
    property: {
      type: 'Identifier',
      name: 'given'
    }
  }
}
```

This example demonstrates:
- **Member access chaining**: `Patient.name` represented as nested `MemberExpression` nodes
- **Method invocations**: `.where(...)` represented as `InvocationExpression` with `MethodInvocation`
- **Binary operations**: Both `=` (equality) and `|` (union)
- **Position tracking**: Each node includes precise position information
- **Nested structure**: The AST properly captures the precedence and associativity

The key distinction is that FHIRPath's fluent syntax `.methodName(args)` is represented as:
- `InvocationExpression` containing the object and the invocation
- `MethodInvocation` for the method call itself (name + arguments)
- This separates the "dot-invocation" syntax from regular function calls

### 7. Special Forms and FHIR-Specific Extensions

#### Special Forms
FHIRPath has one special form that requires lazy evaluation:

**`iif(condition, true-result [, false-result])`**: Immediate if with short-circuit evaluation
- Only evaluates the branch that matches the condition
- Parser must recognize this and generate a special AST node
- Cannot be treated as a regular function call
- Can be called as both `iif(...)` and `.iif(...)` but always requires special handling
- Unlike other functions, arguments must NOT be evaluated before the call

```typescript
// Parser handling for iif in both contexts
// 1. As a bare function: iif(...)
if (name === 'iif' && this.peek() === '(') {
  const iifExpr = this.parseIifExpression();
  // Wrap in implicit $this for consistency
  return {
    type: 'InvocationExpression',
    object: {
      type: 'SpecialInvocation',
      name: '$this',
      isImplicit: true
    },
    invocation: iifExpr
  };
}

// 2. As a method: something.iif(...)
private parseMethodInvocation(object: Expression): Expression {
  const name = this.consume(IDENTIFIER);
  if (name.value === 'iif') {
    return {
      type: 'InvocationExpression',
      object,
      invocation: this.parseIifExpression()
    };
  }
  // ... handle other methods
}

private parseIifExpression(): IifExpression {
  this.consume('(');
  const condition = this.expression();
  this.consume(',');
  const thenBranch = this.expression();
  let elseBranch: Expression | undefined;
  if (this.match(',')) {
    elseBranch = this.expression();
  }
  this.consume(')');
  return {
    type: 'IifExpression',
    condition,
    thenBranch,
    elseBranch
  };
}
```

#### Additional FHIR Functions
The FHIR specification adds several functions to FHIRPath. These are parsed as regular method calls but have special semantics:

```typescript
// FHIR-specific functions that are methods on collections
const FHIR_FUNCTIONS = new Set([
  'extension',      // extension(url: string)
  'hasValue',       // hasValue(): Boolean
  'getValue',       // getValue(): System.[type]
  'resolve',        // resolve(): collection
  'elementDefinition', // elementDefinition(): collection
  'slice',          // slice(structure: string, name: string)
  'checkModifiers', // checkModifiers(modifier: string)
  'conformsTo',     // conformsTo(structure: string): Boolean
  'memberOf',       // memberOf(valueset: string): Boolean
  'subsumes',       // subsumes(code: Coding | CodeableConcept): Boolean
  'subsumedBy',     // subsumedBy(code: Coding | CodeableConcept): Boolean
  'htmlChecks',     // htmlChecks(): Boolean
  'lowBoundary',    // lowBoundary(): T
  'highBoundary',   // highBoundary(): T
  'comparable',     // comparable(quantity): boolean
  'weight'          // weight(): decimal
]);
```

#### Environment Variables
FHIR adds special environment variables that need to be parsed:

```typescript
// For expressions like %resource, %sct, %loinc, %`vs-observation-vitalsignresult`
interface EnvironmentVariable extends Expression {
  type: 'EnvironmentVariable';
  name: string;  // 'resource', 'sct', 'loinc', 'vs-observation-vitalsignresult', etc.
}
```

Parser handling:
```typescript
if (this.match('%')) {
  if (this.match('`')) {
    // Handle quoted environment variable like %`vs-name`
    const name = this.consumeUntil('`');
    this.consume('`');
    return { type: 'EnvironmentVariable', name };
  } else {
    // Handle simple environment variable like %resource
    const name = this.consume(IDENTIFIER).value;
    return { type: 'EnvironmentVariable', name };
  }
}
```

### 8. Corner Cases

#### Standalone Function Calls
FHIRPath has only 3 true standalone functions that don't operate on a collection. All other function calls are methods on implicit `$this`.

For expressions like `today()`:

```typescript
{
  type: 'StandaloneFunctionCall',
  name: 'today',
  arguments: []
}
```

For expressions like `count()` (a bare function call that's actually a method on implicit $this):

```typescript
{
  type: 'InvocationExpression',
  object: {
    type: 'SpecialInvocation',
    name: '$this',
    isImplicit: true  // Parser inserted this
  },
  invocation: {
    type: 'MethodInvocation',
    name: 'count',
    arguments: []
  }
}
```

For expressions like `$this.count()` (explicit $this):

```typescript
{
  type: 'InvocationExpression',
  object: {
    type: 'SpecialInvocation',
    name: '$this',
    isImplicit: false  // User wrote this explicitly
  },
  invocation: {
    type: 'MethodInvocation',
    name: 'count',
    arguments: []
  }
}
```

The parser applies a simple rule:
1. If it's `today()`, `now()`, or `timeOfDay()` → `StandaloneFunctionCall`
2. Otherwise, ALL bare function calls get implicit `$this` → `InvocationExpression` with `$this`

#### Distinguishing Standalone Functions from Methods

In FHIRPath, there's a fundamental rule from the spec:
> "With a few minor exceptions (e.g. the today() function), functions in FHIRPath always take a collection as input"

This means:
1. **Only 3 standalone functions exist**: `today()`, `now()`, `timeOfDay()`
2. **ALL other function calls are method calls** on either:
   - An explicit receiver (e.g., `Patient.name.count()`)
   - An implicit `$this` receiver (e.g., `count()` when used alone or inside `select()`)

For the expression `Patient.name.given.select(substring(0,1))`, the parser should handle:
- `select` as a method invocation on `Patient.name.given`
- `substring` as a method invocation on the implicit `$this` within `select`

**Solution**: We'll handle this at the parser level by:

1. **Parser Context Tracking**: The parser maintains whether we're in a "receiver context" or not
2. **Implicit Receiver**: Inside function arguments like `select()`, there's an implicit receiver

Example parse tree for `Patient.name.given.select(substring(0,1))`:

**Better Approach - Explicit Implicit Receiver**:

Since `substring(0,1)` inside `select()` is actually `$this.substring(0,1)`, we should make this explicit in the AST:

```typescript
{
  type: 'InvocationExpression',
  object: {
    type: 'MemberExpression',
    object: {
      type: 'MemberExpression',
      object: {
        type: 'Identifier',
        name: 'Patient'
      },
      property: {
        type: 'Identifier',
        name: 'name'
      }
    },
    property: {
      type: 'Identifier',
      name: 'given'
    }
  },
  invocation: {
    type: 'MethodInvocation',
    name: 'select',
    arguments: [{
      type: 'InvocationExpression',
      object: {
        type: 'SpecialInvocation',
        name: '$this',
        isImplicit: true  // Parser inserted this
      },
      invocation: {
        type: 'MethodInvocation',
        name: 'substring',
        arguments: [
          {
            type: 'NumberLiteral',
            value: 0
          },
          {
            type: 'NumberLiteral',
            value: 1
          }
        ]
      }
    }]
  }
}
```

**Parser Context Tracking**:

The parser tracks lambda contexts and automatically inserts `$this` for bare identifiers and function calls:

```typescript
class FHIRPathParser {
  private lambdaDepth = 0;
  
  private parseExpression(): Expression {
    // When we see an identifier at the start of an expression
    const name = this.peek();
    
    if (this.peekNext() === '(') {
      // Check for special forms first
      if (name.value === 'iif') {
        const iifExpr = this.parseIifExpression();
        // Even iif gets wrapped in implicit $this for consistency
        return {
          type: 'InvocationExpression',
          object: {
            type: 'SpecialInvocation',
            name: '$this',
            isImplicit: true
          },
          invocation: iifExpr
        };
      } else if (STANDALONE_FUNCTIONS.has(name.value)) {
        // It's one of the 3 standalone functions
        return this.parseStandaloneFunctionCall();
      } else {
        // ALL other function calls are method calls on implicit $this
        return {
          type: 'InvocationExpression',
          object: {
            type: 'SpecialInvocation',
            name: '$this',
            isImplicit: true  // Mark that parser inserted this
          },
          invocation: {
            type: 'MethodInvocation',
            name: this.consume(IDENTIFIER).value,
            arguments: this.parseArguments()
          }
        };
      }
    } else {
      // Bare identifier - add implicit $this
      return {
        type: 'MemberExpression',
        object: {
          type: 'SpecialInvocation',
          name: '$this',
          isImplicit: true
        },
        property: {
          type: 'Identifier',
          name: this.consume(IDENTIFIER).value
        }
      };
    }
    // ... continue with other expression parsing
  }
}
```

**Decision**: We'll make implicit receivers explicit in the AST by applying a simple rule:
1. If it's one of the 3 standalone functions (`today`, `now`, `timeOfDay`) → `StandaloneFunctionCall`
2. Otherwise, ALL function calls are method calls on `$this` → `InvocationExpression` with `$this`

This approach:
- **Follows the spec exactly**: "With a few minor exceptions, functions in FHIRPath always take a collection as input"
- **Eliminates ambiguity**: The AST clearly shows what's a method call vs a standalone function
- **Simplifies parser logic**: No need to track lambda contexts or distinguish between different function types
- **Consistent representation**: All method calls have an explicit receiver in the AST
- **Better error messages**: Can provide context-aware errors like "count() requires a collection" vs "$this.count() requires a collection"
- **Debugging support**: Tools can show whether $this was implicit or explicit in the original source

**Better Solution - Hardcoded Standalone Functions**:

Actually, since FHIRPath has a well-defined, stable set of standalone functions, we can hardcode them in the parser and generate different AST nodes:

```typescript
// Standalone functions that can ONLY be called without a receiver
// Based on FHIRPath spec: "With a few minor exceptions (e.g. the today() function), 
// functions in FHIRPath always take a collection as input"
const STANDALONE_FUNCTIONS = new Set([
  'today',
  'now', 
  'timeOfDay'
]);

// During parsing:
if (STANDALONE_FUNCTIONS.has(functionName) && !hasReceiver) {
  return {
    type: 'StandaloneFunctionCall',
    name: functionName,
    arguments: [...]
  };
} else {
  return {
    type: 'CallExpression',
    callee: { type: 'Identifier', name: functionName },
    arguments: [...]
  };
}
```

Add new AST node:

```typescript
interface StandaloneFunctionCall extends Expression {
  type: 'StandaloneFunctionCall';
  name: 'today' | 'now' | 'timeOfDay' | 'currentDate' | 'currentDateTime' | 'currentTime';
  arguments: Expression[];
}
```

This approach:
- Makes the AST more semantic and self-documenting
- Catches errors early (e.g., `Patient.today()` would fail at parse time)
- Simplifies the evaluator since it doesn't need to determine function type
- Is maintainable since FHIRPath's function set is stable

#### Special Invocations
FHIRPath has special invocations like `$this`, `$index`, `$total`:

```typescript
// For: $this
{
  type: 'SpecialInvocation',
  name: '$this'
}

// For: $index
{
  type: 'SpecialInvocation', 
  name: '$index'
}
```

#### Empty Collection Literal
For the empty collection `{}`:

```typescript
{
  type: 'EmptyCollectionLiteral'
}
```

#### External Constants
For expressions like `%context` or `%"vs-administrative-gender"`:

```typescript
{
  type: 'ExternalConstant',
  name: 'context'  // or "vs-administrative-gender"
}
```

### 9. Design Decision: MemberExpression vs InvocationExpression

#### Why Not Merge?

While both use the dot notation, they represent fundamentally different operations:

**MemberExpression** (e.g., `Patient.name`):
- Simple property access
- No computation involved
- Returns the value of a property
- Cannot have arguments

**InvocationExpression** (e.g., `Patient.exists()`, `Patient.where(...)`):
- Method/function invocation
- Involves computation
- Can have arguments
- Can contain special forms like `iif`

#### Semantic Differences

```typescript
// Property access - just navigation
Patient.name.given  // MemberExpression chain

// Method call - computation
Patient.name.exists()  // MemberExpression + InvocationExpression

// Complex case showing the difference
Patient.name.where(use = 'official').given
//      ^^^^                          ^^^^^  MemberExpression
//           ^^^^^^^^^^^^^^^^^^^^^^^^        InvocationExpression
```

The evaluator needs to handle these differently:
- `MemberExpression`: Navigate to property in data structure
- `InvocationExpression`: Execute function with context

### 10. Design Decision: Implicit $this in Lambda Contexts

#### The Question
Can the parser treat bare identifiers as implicit property access on `$this` inside lambda contexts?

For example:
- `name.where(use = 'official')` → `name.where($this.use = 'official')`
- `select(given + ' ' + family)` → `select($this.given + ' ' + $this.family)`

#### Answer: YES, with careful rules

Looking at the FHIRPath spec examples, bare identifiers inside lambda contexts (`where`, `select`, `all`, `exists`, etc.) always refer to properties of the current item. The parser can safely add implicit `$this` following these rules:

1. **Inside lambda function arguments**, bare identifiers at the start of a path become `$this.identifier`
2. **Exception**: Special variables (`$this`, `$index`, `$total`) remain as-is
3. **Exception**: Type names in `is`/`as` expressions remain as-is
4. **Exception**: Standalone functions (`today`, `now`, `timeOfDay`) remain as-is

#### Examples from the spec:

```fhirpath
// Spec example:
Patient.telecom.where(use = 'official')
// Parser AST would have:
// use → $this.use (implicit)

// Spec example:
Patient.name.select(given.first() + ' ' + family)
// Parser AST would have:
// given → $this.given (implicit)
// family → $this.family (implicit)

// Complex example:
Bundle.entry.select((resource as Patient).telecom.where(system = 'phone'))
// Parser AST would have:
// resource → $this.resource (implicit in select)
// system → $this.system (implicit in where)
```

#### Implementation approach:

```typescript
class FHIRPathParser {
  private lambdaDepth = 0;
  private LAMBDA_FUNCTIONS = new Set(['where', 'select', 'all', 'exists', 'repeat']);
  
  private parseIdentifier(): Expression {
    const name = this.consume(IDENTIFIER);
    
    // Inside lambda and not a special case
    if (this.lambdaDepth > 0 && 
        !name.value.startsWith('$') && 
        !STANDALONE_FUNCTIONS.has(name.value) &&
        !this.isTypeName(name.value)) {
      
      // Create implicit $this.identifier
      return {
        type: 'MemberExpression',
        object: {
          type: 'SpecialInvocation',
          name: '$this',
          isImplicit: true
        },
        property: {
          type: 'Identifier',
          name: name.value
        }
      };
    }
    
    return { type: 'Identifier', name: name.value };
  }
}
```

This approach:
- Makes the AST explicit about what's happening
- Simplifies the evaluator (no need to track implicit context)
- Matches the FHIRPath semantics exactly
- Provides better error messages

### 11. Design Decision: Implicit $this Throughout Parser

#### The Core Principle
FHIRPath expressions always operate on an implicit context (`$this`). The parser makes this explicit in the AST for clarity and consistency.

#### Where Implicit $this is Added

1. **Root Level Identifiers**
   - `Patient.name` → `$this.Patient.name`
   - `name.given` → `$this.name.given`
   - `active` → `$this.active`

2. **Bare Function Calls** (except standalone functions)
   - `count()` → `$this.count()`
   - `exists()` → `$this.exists()`
   - `where(...)` → `$this.where(...)`

3. **Inside Lambda Contexts**
   - `where(use = 'official')` → `where($this.use = 'official')`
   - `select(given + family)` → `select($this.given + $this.family)`

4. **Special Form: iif**
   - `iif(...)` → `$this.iif(...)` (wrapped for consistency)

#### Rationale

This design provides several benefits:

1. **Explicit Semantics**: The AST clearly shows what's happening - all expressions operate on context
2. **Simplified Evaluator**: No need to track implicit context during evaluation
3. **Better Error Messages**: Can provide context-aware errors
4. **Debugging Support**: Tools can show whether $this was implicit or explicit
5. **Spec Compliance**: Matches FHIRPath's semantic model exactly

#### Implementation Strategy

The parser adds implicit `$this` uniformly to ALL root identifiers:

```typescript
// Both type names and properties get implicit $this
Patient.name → 
{
  type: 'MemberExpression',
  object: {
    type: 'MemberExpression',
    object: {
      type: 'SpecialInvocation',
      name: '$this',
      isImplicit: true
    },
    property: {
      type: 'Identifier',
      name: 'Patient'  // Evaluator determines if type or property
    }
  },
  property: {
    type: 'Identifier',
    name: 'name'
  }
}

// Same for properties
name.given →
{
  type: 'MemberExpression',
  object: {
    type: 'MemberExpression',
    object: {
      type: 'SpecialInvocation',
      name: '$this',
      isImplicit: true
    },
    property: {
      type: 'Identifier',
      name: 'name'
    }
  },
  property: {
    type: 'Identifier',
    name: 'given'
  }
}
```

This design:
1. **Uniform AST**: All root identifiers are treated the same
2. **Simple parser**: No need to distinguish types from properties
3. **Evaluator decides**: Whether to treat as type filter or property access
4. **Correct semantics**: `Patient` on `$this` still means "filter by type"

#### Parser Implementation

```typescript
private parsePrimaryExpression(): Expression {
  if (this.match(IDENTIFIER)) {
    const name = this.previous();
    
    // At root level, ALL identifiers get implicit $this
    return {
      type: 'MemberExpression',
      object: {
        type: 'SpecialInvocation',
        name: '$this',
        isImplicit: true
      },
      property: {
        type: 'Identifier',
        name: name.value
      }
    };
  }
  
  // Handle other primary expressions...
}
```

#### Examples:

```fhirpath
// ALL root identifiers get implicit $this
Patient.name        → $this.Patient.name
name.given         → $this.name.given
active             → $this.active

// The evaluator interprets these as:
$this.Patient.name  // If $this is a Patient type, get name (type filter)
$this.name.given    // Get name property then given (property access)
$this.active        // Get active property (property access)
```

#### How the evaluator handles $this.Patient:

```typescript
// During evaluation:
evaluate($this.Patient) {
  // Check if "Patient" is a known type
  if (isTypeName("Patient")) {
    // Type filter: return $this if it's a Patient, empty otherwise
    return $this.is(Patient) ? $this : empty;
  } else {
    // Property access: look for a property named "Patient"
    return $this.getProperty("Patient");
  }
}
```

This approach:
- **Simplifies the parser**: Just add `$this` to all root identifiers
- **Preserves semantics**: Type filtering still works correctly
- **Uniform AST**: No special cases for type vs property names
- **Clear evaluation model**: The evaluator decides based on context

#### Why This Design?

1. **Type safety**: `Patient.name` ensures we're operating on a Patient
2. **Polymorphism**: Same expression works on different types
3. **Clear semantics**: Type names filter, property names navigate
4. **Spec compliance**: Matches FHIRPath resolution rules

### 12. Comprehensive Expression Examples

This section provides AST examples for all major FHIRPath expression types.

#### 12.1 Simple Path Navigation

Expression: `Patient.name.given`

```typescript
{
  type: 'MemberExpression',
  object: {
    type: 'MemberExpression',
    object: {
      type: 'MemberExpression',
      object: {
        type: 'SpecialInvocation',
        name: '$this',
        isImplicit: true
      },
      property: {
        type: 'Identifier',
        name: 'Patient'  // Evaluator will recognize as type
      }
    },
    property: {
      type: 'Identifier',
      name: 'name'
    }
  },
  property: {
    type: 'Identifier',
    name: 'given'
  }
}
```

#### 12.2 Method Invocation with Arguments

Expression: `name.matches('John.*')`

```typescript
{
  type: 'InvocationExpression',
  object: {
    type: 'MemberExpression',
    object: {
      type: 'SpecialInvocation',
      name: '$this',
      isImplicit: true
    },
    property: {
      type: 'Identifier',
      name: 'name'
    }
  },
  invocation: {
    type: 'MethodInvocation',
    name: 'matches',
    arguments: [{
      type: 'StringLiteral',
      value: 'John.*',
      raw: "'John.*'"
    }]
  }
}
```

#### 12.3 Indexer Access

Expression: `name[0].given[1]`

```typescript
{
  type: 'IndexExpression',
  object: {
    type: 'MemberExpression',
    object: {
      type: 'IndexExpression',
      object: {
        type: 'MemberExpression',
        object: {
          type: 'SpecialInvocation',
          name: '$this',
          isImplicit: true
        },
        property: {
          type: 'Identifier',
          name: 'name'
        }
      },
      index: {
        type: 'NumberLiteral',
        value: 0
      }
    },
    property: {
      type: 'Identifier',
      name: 'given'
    }
  },
  index: {
    type: 'NumberLiteral',
    value: 1
  }
}
```

#### 12.4 Binary Operations with Precedence

Expression: `age > 18 and status = 'active' or priority = 1`

```typescript
{
  type: 'BinaryExpression',
  operator: 'or',
  left: {
    type: 'BinaryExpression',
    operator: 'and',
    left: {
      type: 'BinaryExpression',
      operator: '>',
      left: {
        type: 'MemberExpression',
        object: {
          type: 'SpecialInvocation',
          name: '$this',
          isImplicit: true
        },
        property: {
          type: 'Identifier',
          name: 'age'
        }
      },
      right: {
        type: 'NumberLiteral',
        value: 18
      }
    },
    right: {
      type: 'BinaryExpression',
      operator: '=',
      left: {
        type: 'MemberExpression',
        object: {
          type: 'SpecialInvocation',
          name: '$this',
          isImplicit: true
        },
        property: {
          type: 'Identifier',
          name: 'status'
        }
      },
      right: {
        type: 'StringLiteral',
        value: 'active',
        raw: "'active'"
      }
    }
  },
  right: {
    type: 'BinaryExpression',
    operator: '=',
    left: {
      type: 'MemberExpression',
      object: {
        type: 'SpecialInvocation',
        name: '$this',
        isImplicit: true
      },
      property: {
        type: 'Identifier',
        name: 'priority'
      }
    },
    right: {
      type: 'NumberLiteral',
      value: 1
    }
  }
}
```

#### 12.5 Type Operations

Expression: `value.as(Quantity).unit`

```typescript
{
  type: 'MemberExpression',
  object: {
    type: 'BinaryExpression',
    operator: 'as',
    left: {
      type: 'MemberExpression',
      object: {
        type: 'SpecialInvocation',
        name: '$this',
        isImplicit: true
      },
      property: {
        type: 'Identifier',
        name: 'value'
      }
    },
    right: {
      type: 'Identifier',
      name: 'Quantity'
    }
  },
  property: {
    type: 'Identifier',
    name: 'unit'
  }
}
```

#### 12.6 Unary Operations

Expression: `-value + 10`

```typescript
{
  type: 'BinaryExpression',
  operator: '+',
  left: {
    type: 'UnaryExpression',
    operator: '-',
    operand: {
      type: 'MemberExpression',
      object: {
        type: 'SpecialInvocation',
        name: '$this',
        isImplicit: true
      },
      property: {
        type: 'Identifier',
        name: 'value'
      }
    }
  },
  right: {
    type: 'NumberLiteral',
    value: 10
  }
}
```

#### 12.7 Standalone Function Calls

Expression: `today().add(3 days)`

```typescript
{
  type: 'InvocationExpression',
  object: {
    type: 'StandaloneFunctionCall',
    name: 'today',
    arguments: []
  },
  invocation: {
    type: 'MethodInvocation',
    name: 'add',
    arguments: [{
      type: 'QuantityLiteral',
      value: 3,
      unit: 'days'
    }]
  }
}
```

#### 12.8 Implicit $this Method Calls

Expression: `exists()` (at root level)

```typescript
{
  type: 'InvocationExpression',
  object: {
    type: 'SpecialInvocation',
    name: '$this',
    isImplicit: true
  },
  invocation: {
    type: 'MethodInvocation',
    name: 'exists',
    arguments: []
  }
}
```

#### 12.9 Lambda-like Functions with Implicit $this

Expression: `children.where(name = 'John' and age > 10)`

```typescript
{
  type: 'InvocationExpression',
  object: {
    type: 'MemberExpression',
    object: {
      type: 'SpecialInvocation',
      name: '$this',
      isImplicit: true
    },
    property: {
      type: 'Identifier',
      name: 'children'
    }
  },
  invocation: {
    type: 'MethodInvocation',
    name: 'where',
    arguments: [{
      type: 'BinaryExpression',
      operator: 'and',
      left: {
        type: 'BinaryExpression',
        operator: '=',
        left: {
          type: 'MemberExpression',
          object: {
            type: 'SpecialInvocation',
            name: '$this',
            isImplicit: true
          },
          property: {
            type: 'Identifier',
            name: 'name'
          }
        },
        right: {
          type: 'StringLiteral',
          value: 'John',
          raw: "'John'"
        }
      },
      right: {
        type: 'BinaryExpression',
        operator: '>',
        left: {
          type: 'MemberExpression',
          object: {
            type: 'SpecialInvocation',
            name: '$this',
            isImplicit: true
          },
          property: {
            type: 'Identifier',
            name: 'age'
          }
        },
        right: {
          type: 'NumberLiteral',
          value: 10
        }
      }
    }]
  }
}
```

Note: The parser automatically converts bare identifiers `name` and `age` to `$this.name` and `$this.age` inside the lambda context.

#### 12.10 Special Invocations

Expression: `repeat(item).where($index < 5)`

```typescript
{
  type: 'InvocationExpression',
  object: {
    type: 'InvocationExpression',
    object: {
      type: 'SpecialInvocation',
      name: '$this',
      isImplicit: true
    },
    invocation: {
      type: 'MethodInvocation',
      name: 'repeat',
      arguments: [{
        type: 'MemberExpression',
        object: {
          type: 'SpecialInvocation',
          name: '$this',
          isImplicit: true  // Inside repeat() lambda context
        },
        property: {
          type: 'Identifier',
          name: 'item'
        }
      }]
    }
  },
  invocation: {
    type: 'MethodInvocation',
    name: 'where',
    arguments: [{
      type: 'BinaryExpression',
      operator: '<',
      left: {
        type: 'SpecialInvocation',
        name: '$index',
        isImplicit: false
      },
      right: {
        type: 'NumberLiteral',
        value: 5
      }
    }]
  }
}
```

#### 12.11 External Constants and Environment Variables

Expression: `extension(%`ext-data-absent-reason`).exists()`

```typescript
{
  type: 'InvocationExpression',
  object: {
    type: 'InvocationExpression',
    object: {
      type: 'SpecialInvocation',
      name: '$this',
      isImplicit: true
    },
    invocation: {
      type: 'MethodInvocation',
      name: 'extension',
      arguments: [{
        type: 'EnvironmentVariable',
        name: 'ext-data-absent-reason'
      }]
    }
  },
  invocation: {
    type: 'MethodInvocation',
    name: 'exists',
    arguments: []
  }
}
```

#### 12.12 Complex Literals

Expression: `@2024-01-15T10:30:00Z`

```typescript
{
  type: 'DateTimeLiteral',
  value: new Date('2024-01-15T10:30:00Z'),
  precision: 'second',
  raw: '@2024-01-15T10:30:00Z'
}
```

Expression: `10.5 'mg/dL'`

```typescript
{
  type: 'QuantityLiteral',
  value: 10.5,
  unit: 'mg/dL'
}
```

#### 12.13 Empty Collection

Expression: `{}`

```typescript
{
  type: 'EmptyCollectionLiteral'
}
```

#### 12.14 Parenthesized Expressions

Expression: `(a + b) * c`

```typescript
{
  type: 'BinaryExpression',
  operator: '*',
  left: {
    type: 'BinaryExpression',
    operator: '+',
    left: {
      type: 'Identifier',
      name: 'a'
    },
    right: {
      type: 'Identifier',
      name: 'b'
    }
  },
  right: {
    type: 'Identifier',
    name: 'c'
  }
}
```

#### 12.15 Union Operations

Expression: `name.given | name.family`

```typescript
{
  type: 'BinaryExpression',
  operator: '|',
  left: {
    type: 'MemberExpression',
    object: {
      type: 'MemberExpression',
      object: {
        type: 'SpecialInvocation',
        name: '$this',
        isImplicit: true
      },
      property: {
        type: 'Identifier',
        name: 'name'
      }
    },
    property: {
      type: 'Identifier',
      name: 'given'
    }
  },
  right: {
    type: 'MemberExpression',
    object: {
      type: 'MemberExpression',
      object: {
        type: 'SpecialInvocation',
        name: '$this',
        isImplicit: true
      },
      property: {
        type: 'Identifier',
        name: 'name'
      }
    },
    property: {
      type: 'Identifier',
      name: 'family'
    }
  }
}
```

#### 12.16 FHIR-Specific Functions

Expression: `code.memberOf(%`vs-observation-vitalsignresult`)`

```typescript
{
  type: 'InvocationExpression',
  object: {
    type: 'MemberExpression',
    object: {
      type: 'SpecialInvocation',
      name: '$this',
      isImplicit: true
    },
    property: {
      type: 'Identifier',
      name: 'code'
    }
  },
  invocation: {
    type: 'MethodInvocation',
    name: 'memberOf',
    arguments: [{
      type: 'EnvironmentVariable',
      name: 'vs-observation-vitalsignresult'
    }]
  }
}
```

#### 12.17 Special Form: iif (Immediate If)

Expression: `iif(status = 'active', priority + 1, 0)`

```typescript
{
  type: 'InvocationExpression',
  object: {
    type: 'SpecialInvocation',
    name: '$this',
    isImplicit: true  // Parser wraps bare iif for consistency
  },
  invocation: {
    type: 'IifExpression',
    condition: {
      type: 'BinaryExpression',
      operator: '=',
      left: {
        type: 'MemberExpression',
        object: {
          type: 'SpecialInvocation',
          name: '$this',
          isImplicit: true
        },
        property: {
          type: 'Identifier',
          name: 'status'
        }
      },
      right: {
        type: 'StringLiteral',
        value: 'active',
        raw: "'active'"
      }
    },
    thenBranch: {
      type: 'BinaryExpression',
      operator: '+',
      left: {
        type: 'MemberExpression',
        object: {
          type: 'SpecialInvocation',
          name: '$this',
          isImplicit: true
        },
        property: {
          type: 'Identifier',
          name: 'priority'
        }
      },
      right: {
        type: 'NumberLiteral',
        value: 1
      }
    },
    elseBranch: {
      type: 'NumberLiteral',
      value: 0
    }
  }
}
```

Note: `iif` requires special handling because it has **lazy evaluation semantics** - only the condition and the matching branch should be evaluated, not all arguments. This is critical for avoiding runtime errors. For example:
- `iif(patient.exists(), patient.name, 'Unknown')` - without lazy evaluation, `patient.name` would throw an error if patient is empty
- Regular boolean operators (`and`, `or`) in FHIRPath do NOT guarantee short-circuit evaluation per spec

`iif` can be chained like any other function since it returns a collection:
- `iif(status = 'active', priority, 0).first()` 
- `Patient.iif(active, name, {})`
- `iif(x > 0, x, iif(x < 0, -x, 0))` (nested)
- `value.aggregate(iif($total.empty(), $this, iif($this < $total, $this, $total)))` (real example from spec)

#### 12.18 Chained iif Expression

Expression: `Patient.iif(active, name.given, {}).first()`

```typescript
{
  type: 'InvocationExpression',
  object: {
    type: 'InvocationExpression',
    object: {
      type: 'MemberExpression',
      object: {
        type: 'SpecialInvocation',
        name: '$this',
        isImplicit: true
      },
      property: {
        type: 'Identifier',
        name: 'Patient'
      }
    },
    invocation: {
      type: 'IifExpression',
      condition: {
        type: 'MemberExpression',
        object: {
          type: 'SpecialInvocation',
          name: '$this',
          isImplicit: true  // Inside iif context
        },
        property: {
          type: 'Identifier',
          name: 'active'
        }
      },
      thenBranch: {
        type: 'MemberExpression',
        object: {
          type: 'MemberExpression',
          object: {
            type: 'SpecialInvocation',
            name: '$this',
            isImplicit: true
          },
          property: {
            type: 'Identifier',
            name: 'name'
          }
        },
        property: {
          type: 'Identifier',
          name: 'given'
        }
      },
      elseBranch: {
        type: 'EmptyCollectionLiteral'
      }
    }
  },
  invocation: {
    type: 'MethodInvocation',
    name: 'first',
    arguments: []
  }
}
```

#### 12.19 String Concatenation

Expression: `'Hello, ' + name.given.first() + ' ' + name.family`

```typescript
{
  type: 'BinaryExpression',
  operator: '+',
  left: {
    type: 'BinaryExpression',
    operator: '+',
    left: {
      type: 'BinaryExpression',
      operator: '+',
      left: {
        type: 'StringLiteral',
        value: 'Hello, ',
        raw: "'Hello, '"
      },
      right: {
        type: 'InvocationExpression',
        object: {
          type: 'MemberExpression',
          object: {
            type: 'MemberExpression',
            object: {
              type: 'SpecialInvocation',
              name: '$this',
              isImplicit: true
            },
            property: {
              type: 'Identifier',
              name: 'name'
            }
          },
          property: {
            type: 'Identifier',
            name: 'given'
          }
        },
        invocation: {
          type: 'MethodInvocation',
          name: 'first',
          arguments: []
        }
      }
    },
    right: {
      type: 'StringLiteral',
      value: ' ',
      raw: "' '"
    }
  },
  right: {
    type: 'MemberExpression',
    object: {
      type: 'MemberExpression',
      object: {
        type: 'SpecialInvocation',
        name: '$this',
        isImplicit: true
      },
      property: {
        type: 'Identifier',
        name: 'name'
      }
    },
    property: {
      type: 'Identifier',
      name: 'family'
    }
  }
}
```

## Consequences

### Positive

- **Performance**: Hand-written parser can be optimized for FHIRPath's specific needs
- **Error Messages**: Full control over error reporting and recovery
- **Debugging**: Easier to debug than generated parsers
- **Type Safety**: TypeScript's type system ensures AST consistency
- **Flexibility**: Easy to add custom logic for context-sensitive parsing
- **Bundle Size**: Smaller than parser generator runtime dependencies

### Negative

- **Maintenance**: Grammar changes require manual parser updates
- **Complexity**: More code to write and maintain than using a parser generator
- **Testing**: Need comprehensive tests to ensure correctness
- **Initial Development Time**: Longer initial development compared to parser generators

## Alternatives Considered

### 1. ANTLR with TypeScript Target
- **Pros**: Grammar already exists, automatic parser generation
- **Cons**: Large runtime dependency, harder to customize error messages, less control over performance

### 2. PEG.js / Peggy
- **Pros**: Good TypeScript support, smaller runtime
- **Cons**: Less mature, would need to rewrite grammar

### 3. Nearley
- **Pros**: Pure JavaScript, good error reporting
- **Cons**: Performance concerns, less suitable for complex precedence rules

### 4. Parser Combinators (e.g., Parsimmon)
- **Pros**: Composable, type-safe
- **Cons**: Performance overhead, less intuitive for complex grammars

We chose hand-written recursive descent because:
1. FHIRPath's grammar is stable and unlikely to change frequently
2. Performance is critical for runtime evaluation
3. Error reporting quality is important for developer experience
4. The grammar complexity is manageable for hand-writing
5. We need fine-grained control over parsing behavior