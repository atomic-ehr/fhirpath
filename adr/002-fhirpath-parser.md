# ADR-002: FHIRPath Parser with Pratt Parsing

## Status

Proposed

## Context

We need to implement a FHIRPath parser that:
- Uses tokens from the lexer (see ADR-001)
- Produces S-expression AST as described in fhirpath-parser.md
- Makes implicit context (`$this`) explicit in the AST
- Handles all FHIRPath language features correctly
- Provides excellent error messages with position information
- Is fast and maintainable

The parser must handle:
- 14 levels of operator precedence
- Method chaining with implicit context flow
- Special forms (`iif`, `defineVariable`) that cannot be chained from the left
- Iterative functions that modify `$this` context

## Decision

We will implement a **hand-written Pratt parser** that consumes tokens from the lexer defined in ADR-001.

### 1. Pratt Parser Architecture

We'll use a Pratt parser (operator precedence parser) for its elegance in handling complex precedence rules:

```typescript
import { Token, TokenType } from './lexer'; // From ADR-001

class FHIRPathParser {
  private tokens: Token[];
  private current: number = 0;
  
  // Precedence levels (higher number = higher precedence)
  private readonly PRECEDENCE = {
    IMPLIES: 10,
    OR: 20,
    AND: 30,
    MEMBERSHIP: 40,
    EQUALITY: 50,
    COMPARISON: 60,
    UNION: 70,
    TYPE: 80,
    ADDITIVE: 90,
    MULTIPLICATIVE: 100,
    UNARY: 110,
    POSTFIX: 120,
    MEMBER: 130,
  };
  
  parse(input: string): SExpression {
    this.tokens = lex(input);
    this.current = 0;
    const expr = this.expression(0);
    this.expect(TokenType.EOF);
    return expr;
  }
  
  // Main Pratt parsing loop
  private expression(minPrecedence: number): SExpression {
    let left = this.prefix();
    
    while (this.getPrecedence() >= minPrecedence) {
      left = this.infix(left);
    }
    
    return left;
  }
}
```

### 2. S-Expression AST Format

The parser produces S-expressions using objects with a `type` field (keeping S-expression semantics):

```typescript
type SExpression = 
  | LiteralNode
  | VariableNode
  | EnvVarNode
  | MemberNode
  | MethodNode
  | FunctionNode
  | OperatorNode
  | IndexNode
  | IifNode
  | DefineVarNode
  | TypeNode;

interface LiteralNode {
  type: 'literal';
  valueType: 'empty' | 'boolean' | 'integer' | 'decimal' | 
             'string' | 'date' | 'datetime' | 'time' | 'quantity';
  value: any;
  unit?: string; // for quantity
}

interface VariableNode {
  type: 'variable';
  name: '$this' | '$index' | '$total';
  isImplicit: boolean;
}

interface EnvVarNode {
  type: 'env-var';
  name: string;
}

interface MemberNode {
  type: 'member';
  property: string;
  object: SExpression;
}

interface MethodNode {
  type: 'method';
  name: string;
  object: SExpression;
  args: SExpression[];
}

interface FunctionNode {
  type: 'function';
  name: 'today' | 'now' | 'timeOfDay';
}

interface OperatorNode {
  type: 'operator';
  op: string;
  left: SExpression;
  right: SExpression;
}

interface IndexNode {
  type: 'index';
  object: SExpression;
  index: SExpression;
}

interface IifNode {
  type: 'iif';
  condition: SExpression;
  thenBranch: SExpression;
  elseBranch: SExpression;
}

interface DefineVarNode {
  type: 'define-var';
  name: string;
  value: SExpression;
}

interface TypeNode {
  type: 'type';
  name: string;
}
```

### 3. Implicit $this Handling

The parser adds implicit `$this` in these contexts:

#### 3.1 Root Identifiers
```typescript
private prefix(): SExpression {
  const token = this.peek();
  
  if (token.type === TokenType.IDENTIFIER) {
    const name = this.advance().value;
    
    // Check for special cases
    if (this.isStandaloneFunction(name) && this.peek().type === TokenType.LPAREN) {
      return this.parseStandaloneFunction(name);
    }
    
    // Check for special forms
    if (name === 'iif' && this.peek().type === TokenType.LPAREN) {
      return this.parseIif();
    }
    
    if (name === 'defineVariable' && this.peek().type === TokenType.LPAREN) {
      return this.parseDefineVariable();
    }
    
    // All other identifiers get implicit $this
    return {
      type: 'member',
      property: name,
      object: { type: 'variable', name: '$this', isImplicit: true }
    };
  }
  
  // ... handle other prefix cases
}
```

#### 3.2 Inside Iterative Functions
```typescript
private parseIterativeFunction(name: string, context: SExpression): SExpression {
  this.expect(TokenType.LPAREN);
  
  // Track that we're inside an iterative function
  this.enterIterativeContext();
  
  const args = this.parseArguments();
  
  this.exitIterativeContext();
  this.expect(TokenType.RPAREN);
  
  return {
    type: 'method',
    name: name,
    object: context,
    args: args
  };
}

private isInIterativeContext(): boolean {
  return this.iterativeDepth > 0;
}
```

### 4. Parsing Examples

#### Simple member access
```
Input: Patient.name
Tokens: [IDENTIFIER(Patient), DOT, IDENTIFIER(name)]
AST: {
  type: 'member',
  property: 'name',
  object: {
    type: 'member',
    property: 'Patient',
    object: { type: 'variable', name: '$this', isImplicit: true }
  }
}
```

#### Method invocation with iterative function
```
Input: name.where(use = 'official')
Process:
1. name → {
     type: 'member',
     property: 'name',
     object: { type: 'variable', name: '$this', isImplicit: true }
   }
2. where( → enter iterative context
3. use → {
     type: 'member',
     property: 'use',
     object: { type: 'variable', name: '$this', isImplicit: true }
   }
4. = 'official' → {
     type: 'operator',
     op: '=',
     left: { type: 'member', property: 'use', ... },
     right: { type: 'literal', valueType: 'string', value: 'official' }
   }
5. Result: {
     type: 'method',
     name: 'where',
     object: { type: 'member', property: 'name', ... },
     args: [{ type: 'operator', op: '=', ... }]
   }
```

#### Special form
```
Input: iif(age > 18, 'adult', 'minor')
Process:
1. Recognize 'iif' as special form
2. Parse as {
     type: 'iif',
     condition: {
       type: 'operator',
       op: '>',
       left: { type: 'member', property: 'age', object: { type: 'variable', name: '$this', isImplicit: true } },
       right: { type: 'literal', valueType: 'integer', value: 18 }
     },
     thenBranch: { type: 'literal', valueType: 'string', value: 'adult' },
     elseBranch: { type: 'literal', valueType: 'string', value: 'minor' }
   }
3. Cannot be chained from left (Patient.iif(...) is invalid)
```

### 5. Error Handling

```typescript
class ParseError extends Error {
  constructor(
    message: string,
    public position: Position,
    public expected?: string[],
    public found?: string
  ) {
    super(message);
  }
}

// Example error formatting
private error(message: string): never {
  const token = this.peek();
  const line = this.getLine(token.position.line);
  const pointer = ' '.repeat(token.position.column - 1) + '^';
  
  throw new ParseError(
    `${message} at line ${token.position.line}:${token.position.column}\n` +
    `${line}\n${pointer}`,
    token.position
  );
}
```

### 6. Context-Sensitive Keywords

The keywords 'as', 'contains', 'in', and 'is' can be used as identifiers in certain contexts (per the FHIRPath grammar). The lexer always returns these as keyword tokens, and the parser handles the context sensitivity:

```typescript
private parseIdentifier(): string {
  const token = this.peek();
  
  switch (token.type) {
    case TokenType.IDENTIFIER:
    case TokenType.DELIMITED_IDENTIFIER:
      return this.advance().value;
    
    // Context-sensitive keywords that can be identifiers
    case TokenType.AS:
    case TokenType.CONTAINS:
    case TokenType.IN:
    case TokenType.IS:
      return this.advance().value;
    
    default:
      throw this.error(`Expected identifier, got ${token.type}`);
  }
}

// Usage in qualified identifiers
private parseQualifiedIdentifier(): string[] {
  const parts = [this.parseIdentifier()];
  
  while (this.match(TokenType.DOT)) {
    parts.push(this.parseIdentifier());
  }
  
  return parts;
}
```

This approach:
- Keeps the lexer simple (always returns keyword tokens)
- Handles context sensitivity where needed (in identifier contexts)
- Matches the FHIRPath grammar's `identifier` production rule
- Provides clear error messages

### 7. Key Design Decisions

1. **Pratt Parsing**: Handles complex precedence elegantly without grammar ambiguity
2. **Separate Lexer**: Simplifies parser logic and improves error messages
3. **S-Expression AST with Objects**: 
   - Uses objects instead of arrays for better type safety and readability
   - Maintains S-expression semantics (uniform node structure with `type` field)
   - Easier to work with in TypeScript (intellisense, type checking)
4. **Implicit $this**: Makes context explicit for simpler evaluation
5. **Special Form Handling**: Distinguishes between methods and standalone functions/special forms
6. **Context-Sensitive Keywords**: Parser handles keywords that can be identifiers

### 8. Implementation Structure

```
src/
├── lexer/
│   ├── token.ts        // Token types and interfaces
│   ├── lexer.ts        // Main lexer implementation
│   └── patterns.ts     // Regex patterns for tokens
├── parser/
│   ├── parser.ts       // Main Pratt parser
│   ├── expressions.ts  // Expression parsing methods
│   ├── precedence.ts   // Precedence table
│   └── context.ts      // Context tracking (iterative functions)
├── ast/
│   ├── types.ts        // S-expression type definitions
│   └── builders.ts     // AST construction helpers
└── errors/
    └── parse-error.ts  // Error types and formatting
```

## Consequences

### Positive

- **Clear precedence handling**: Pratt parsing makes operator precedence explicit
- **Maintainable**: Hand-written parser is easier to debug than generated code
- **Explicit context**: Implicit $this makes evaluation simpler
- **Good errors**: Full control over error messages
- **Fast**: No overhead from parser generator runtime

### Negative

- **More code**: Hand-written parser requires more initial implementation
- **Testing**: Need comprehensive tests for all precedence combinations
- **Maintenance**: Grammar changes require manual parser updates

## Alternatives Considered

### 1. Use existing ANTLR grammar
- **Pros**: Grammar already exists, less implementation work
- **Cons**: Less control over AST shape, harder to add implicit $this

### 2. Parser combinators
- **Pros**: Composable, type-safe
- **Cons**: Performance overhead, less suitable for Pratt-style precedence

### 3. Generate from grammar
- **Pros**: Automatic parser generation
- **Cons**: Cannot easily produce our specific S-expression format

We chose hand-written Pratt parser because:
1. FHIRPath's precedence rules are well-suited to Pratt parsing
2. We need fine control over AST generation (implicit $this)
3. S-expression format differs significantly from parse tree
4. Better error messages and debugging experience