# ADR-002: FHIRPath Parser with Pratt Parsing

## Status

Proposed

## Summary of Key Parser Design Principles

### 1. Universal Implicit $this
- **Identifiers**: `age` → `$this.age` (member access on implicit $this)
- **Functions**: `where(...)` → `$this.where(...)` (method call on implicit $this)
- **Members**: All property access is explicit in AST

### 2. Everything is a Method Call
- No distinction between functions and methods in AST
- Standalone functions: `{ type: 'method', name: 'where', object: {type: 'variable', name: '$this', isImplicit: true}, args: [...] }`
- Chained methods: `{ type: 'method', name: 'where', object: <expression>, args: [...] }`

### 3. Uniform AST Structure
- Only essential node types: Literal, Variable, Member, Method, Operator, Unary, Index, Type
- No special nodes for specific functions (iif, defineVariable are just methods)
- Consistent structure makes evaluation simpler

### 4. Pure Syntax Parsing
- Parser only handles syntactic structure
- No semantic validation (e.g., defineVariable's string literal requirement)
- No type checking or constraint enforcement
- All semantic rules belong in the evaluator

### 5. Context Tracking for Nested Expressions
- Parser tracks when inside function arguments
- Ensures correct implicit $this insertion at all levels
- Doesn't distinguish between function types - all get same treatment

### 6. Pratt Parsing for Clean Precedence
- Elegant handling of 14 precedence levels
- No grammar ambiguity
- Easy to maintain and extend

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
    IMPLIES: 10,           // implies
    OR: 20,                // or, xor
    AND: 30,               // and
    MEMBERSHIP: 40,        // in, contains
    EQUALITY: 50,          // =, ~, !=, !~
    COMPARISON: 60,        // <, >, <=, >=
    UNION: 70,             // |
    TYPE: 80,              // is, as
    ADDITIVE: 90,          // +, -, &
    MULTIPLICATIVE: 100,   // *, /, div, mod
    UNARY: 110,            // unary +, unary - (prefix)
    POSTFIX: 120,          // [] (indexer), . (member access)
    MEMBER: 130,           // highest precedence for member access
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
  
  // Parse prefix expressions (literals, identifiers, unary ops, etc.)
  private prefix(): SExpression {
    // Implementation shown in section 3.1
  }
  
  // Parse infix expressions (binary ops, member access, method calls, etc.)
  private infix(left: SExpression): SExpression {
    const token = this.peek();
    
    switch (token.type) {
      case TokenType.DOT:
        return this.parseMemberAccess(left);
      case TokenType.LBRACKET:
        return this.parseIndexer(left);
      case TokenType.LPAREN:
        return this.parseMethodCall(left);
      // Binary operators
      case TokenType.PLUS:
      case TokenType.MINUS:
      case TokenType.STAR:
      // ... other operators
        return this.parseBinaryOp(left);
      default:
        throw this.error(`Unexpected token in infix position: ${token.type}`);
    }
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
  | OperatorNode
  | UnaryNode
  | IndexNode
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
  isImplicit: boolean; // true for automatically inserted $this
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
  object?: SExpression; // Optional - when absent, uses $this from parent scope
  args: SExpression[];
}

interface OperatorNode {
  type: 'operator';
  op: string;
  left: SExpression;
  right: SExpression;
}

interface UnaryNode {
  type: 'unary';
  op: '+' | '-';
  operand: SExpression;
}

interface IndexNode {
  type: 'index';
  object: SExpression;
  index: SExpression;
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
    
    // Check if this is a function call (has parentheses)
    if (this.peek().type === TokenType.LPAREN) {
      // All standalone functions are method calls on implicit $this
      const implicitThis: VariableNode = {
        type: 'variable',
        name: '$this',
        isImplicit: true
      };
      return this.parseMethodCall(implicitThis, name);
    }
    
    // All other identifiers get implicit $this
    return {
      type: 'member',
      property: name,
      object: { type: 'variable', name: '$this', isImplicit: true }
    };
  }
  
  // Handle unary operators (polarity expressions)
  if (token.type === TokenType.PLUS || token.type === TokenType.MINUS) {
    const op = this.advance().value as '+' | '-';
    const operand = this.expression(this.PRECEDENCE.UNARY);
    return {
      type: 'unary',
      op: op,
      operand: operand
    };
  }
  
  // ... handle other prefix cases
}
```

#### 3.2 Inside Context-Changing Functions
```typescript
// For parsing any function/method call
private parseFunctionCall(name: string, object?: SExpression): SExpression {
  this.expect(TokenType.LPAREN);
  
  // Track context depth for implicit $this handling
  this.enterFunctionContext();
  
  const args = this.parseArguments();
  
  this.exitFunctionContext();
  this.expect(TokenType.RPAREN);
  
  return {
    type: 'method',
    name: name,
    object: object, // undefined for standalone functions
    args: args
  };
}

// Handle method calls (. operator)
private parseMethodCall(object: SExpression, name?: string): SExpression {
  // If name not provided, consume identifier token
  if (!name) {
    name = this.advance().value;
  }
  
  // All functions use standard parsing
  return this.parseFunctionCall(name, object);
}

```

### 4. Function Context Rules

All functions in FHIRPath follow the same universal context rule:

**Universal Rule:**
- **Standalone** (no left chain): Function receives `$this` from parent scope
- **Chained** (has left expression): Function receives left expression result as context

```typescript
// Examples - all are MethodNode in AST:
where(use = 'official')                    // { type: 'method', name: 'where', object: {type: 'variable', name: '$this', isImplicit: true}, args: [...] }
name.where(use = 'official')               // { type: 'method', name: 'where', object: name, args: [...] }

select(given + ' ' + family)               // { type: 'method', name: 'select', object: {type: 'variable', name: '$this', isImplicit: true}, args: [...] }
name.select(given + ' ' + family)          // { type: 'method', name: 'select', object: name, args: [...] }

iif(age > 18, 'adult', 'minor')           // { type: 'method', name: 'iif', object: {type: 'variable', name: '$this', isImplicit: true}, args: [...] }
patient.iif(age > 18, 'adult', 'minor')    // { type: 'method', name: 'iif', object: patient, args: [...] }

today()                                    // { type: 'method', name: 'today', object: {type: 'variable', name: '$this', isImplicit: true}, args: [] }
patient.today()                            // { type: 'method', name: 'today', object: patient, args: [] }
```

**What functions do with context is NOT a parser concern:**
- Some pass context to their arguments (`where`, `select`, `iif`, etc.)
- Some ignore context entirely (`today`, `now`, `timeOfDay`)
- Some introduce additional variables (`aggregate` adds `$total`)

The parser simply:
1. Parses the function call structure
2. Tracks whether it's standalone or chained
3. Leaves context handling to the evaluator

#### 4.1 Parser's Role in Implicit $this

The parser only needs to track context depth to correctly insert implicit `$this`:

```typescript
class FHIRPathParser {
  private contextDepth: number = 0;
  
  // When parsing function arguments that might have different $this
  private enterFunctionContext(): void {
    this.contextDepth++;
  }
  
  private exitFunctionContext(): void {
    this.contextDepth--;
  }
  
  // Used to decide if identifier needs implicit $this
  private isInNestedContext(): boolean {
    return this.contextDepth > 0;
  }
}
```

When the parser sees an identifier like `use` or `age`:
- It always adds implicit `$this`: `{ type: 'member', property: 'use', object: { type: 'variable', name: '$this', isImplicit: true } }`
- The evaluator decides what `$this` refers to based on the context

### 5. Semantic Constraints (Evaluator Concerns)

The parser treats all functions identically. Semantic constraints are enforced by the evaluator:

#### 5.1 Runtime Constraints

- **iif()**: When chained, the object must be a singleton value
- **defineVariable()**: First argument must be a string literal

#### 5.2 Context-Independent Functions

Functions like `today()`, `now()`, and `timeOfDay()` don't use context:
- Return constant values regardless of context
- Can still be chained syntactically: `patient.today()`
- The evaluator ignores any context when computing their value

**Summary:**
The parser treats ALL functions uniformly:
- Standalone functions are method calls on implicit `$this`
- Chained functions are method calls on the left expression
- NO special validation in parser
- ALL constraints and semantic differences are evaluator concerns

### 6. Parsing Examples

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

#### Standalone function example
```
Input: iif(age > 18, 'adult', 'minor')
Process:
1. 'iif' is recognized as a function call
2. Parsed as method call on implicit $this
3. Result: {
     type: 'method',
     name: 'iif',
     object: { type: 'variable', name: '$this', isImplicit: true },
     args: [
       { // condition
         type: 'operator',
         op: '>',
         left: { 
           type: 'member', 
           property: 'age', 
           object: { type: 'variable', name: '$this', isImplicit: true }
         },
         right: { type: 'literal', valueType: 'integer', value: 18 }
       },
       { type: 'literal', valueType: 'string', value: 'adult' },    // then
       { type: 'literal', valueType: 'string', value: 'minor' }     // else
     ]
   }
```

#### Chained iif() example
```
Input: Patient.name.first().iif(text.exists(), text, family+given.first())
Process:
1. Patient.name.first() → parsed as left expression
2. .iif(...) → Parse as method call with the left expression as object
3. Inside iif arguments, $this refers to the result of Patient.name.first()
4. Result: {
     type: 'method',
     name: 'iif',
     object: { /* the Patient.name.first() expression */ },
     args: [
       { // condition: text.exists()
         type: 'method',
         name: 'exists',
         object: {
           type: 'member',
           property: 'text',
           object: { type: 'variable', name: '$this', isImplicit: true }
         },
         args: []
       },
       { // then: text
         type: 'member',
         property: 'text',
         object: { type: 'variable', name: '$this', isImplicit: true }
       },
       { // else: family+given.first()
         type: 'operator',
         op: '+',
         left: {
           type: 'member',
           property: 'family',
           object: { type: 'variable', name: '$this', isImplicit: true }
         },
         right: {
           type: 'method',
           name: 'first',
           object: {
             type: 'member',
             property: 'given',
             object: { type: 'variable', name: '$this', isImplicit: true }
           },
           args: []
         }
       }
     ]
   }
```

#### defineVariable examples

**Standalone usage:**
```
Input: defineVariable('patientAge', age + 5)
Process:
1. 'defineVariable' is recognized as a function call
2. Parsed as method call on implicit $this
3. Result: {
     type: 'method',
     name: 'defineVariable',
     object: { type: 'variable', name: '$this', isImplicit: true },
     args: [
       { type: 'literal', valueType: 'string', value: 'patientAge' }, // name
       { // value: age + 5
         type: 'operator',
         op: '+',
         left: { 
           type: 'member', 
           property: 'age', 
           object: { type: 'variable', name: '$this', isImplicit: true }
         },
         right: { type: 'literal', valueType: 'integer', value: 5 }
       }
     ]
   }
```

**Chained usage:**
```
Input: Patient.name.first().defineVariable('firstName', given | family)
Process:
1. Patient.name.first() → produces left expression
2. defineVariable creates variable 'firstName'
3. Value expression 'given | family' is evaluated with $this = Patient.name.first()
4. Result: {
     type: 'method',
     name: 'defineVariable',
     object: { /* the Patient.name.first() expression */ },
     args: [
       { type: 'literal', valueType: 'string', value: 'firstName' }, // name
       { // value: given | family
         type: 'operator',
         op: '|',
         left: { type: 'member', property: 'given', object: { type: 'variable', name: '$this', isImplicit: true } },
         right: { type: 'member', property: 'family', object: { type: 'variable', name: '$this', isImplicit: true } }
       }
     ]
   }
```

### 7. Error Handling

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

### 8. Context-Sensitive Keywords

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

### 9. Key Design Decisions

1. **Pratt Parsing**: Handles complex precedence elegantly without grammar ambiguity
2. **Separate Lexer**: Simplifies parser logic and improves error messages
3. **S-Expression AST with Objects**: 
   - Uses objects instead of arrays for better type safety and readability
   - Maintains S-expression semantics (uniform node structure with `type` field)
   - Easier to work with in TypeScript (intellisense, type checking)
4. **Implicit $this**: Makes all member access explicit in AST for simpler evaluation
5. **Uniform Function Treatment**: All functions follow the same context rules
   - Standalone: receive context from parent scope
   - Chained: receive left expression as context
   - Special parsing only for specific constraints (iif singleton, defineVariable string literal)
6. **Context-Sensitive Keywords**: Parser handles keywords that can be identifiers
7. **Separation of Concerns**: Parser focuses on structure, evaluator handles semantics

### 10. Parser Helper Methods

The parser requires several helper methods for correct operation:

```typescript
class FHIRPathParser {
  // Token navigation
  private peek(): Token {
    return this.tokens[this.current] || { type: TokenType.EOF, value: '', position: this.getEOFPosition() };
  }
  
  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current++;
    }
    return this.previous();
  }
  
  private previous(): Token {
    return this.tokens[this.current - 1];
  }
  
  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }
  
  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }
  
  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }
  
  private expect(type: TokenType, message?: string): Token {
    if (this.check(type)) return this.advance();
    throw this.error(message || `Expected ${type}`);
  }
  
  // Precedence handling
  private getPrecedence(): number {
    const token = this.peek();
    switch (token.type) {
      case TokenType.IMPLIES: return this.PRECEDENCE.IMPLIES;
      case TokenType.OR: 
      case TokenType.XOR: return this.PRECEDENCE.OR;
      case TokenType.AND: return this.PRECEDENCE.AND;
      case TokenType.IN:
      case TokenType.CONTAINS: return this.PRECEDENCE.MEMBERSHIP;
      // ... etc
      default: return 0;
    }
  }
  
  // Argument parsing
  private parseArguments(): SExpression[] {
    const args: SExpression[] = [];
    
    if (!this.check(TokenType.RPAREN)) {
      do {
        args.push(this.expression(0));
      } while (this.match(TokenType.COMMA));
    }
    
    return args;
  }
  
  // Error handling helpers
  private getLine(lineNumber: number): string {
    // Return the source line for error formatting
    const lines = this.input.split('\n');
    return lines[lineNumber - 1] || '';
  }
  
  private synchronize(): void {
    // Error recovery: advance to a safe state
    this.advance();
    
    while (!this.isAtEnd()) {
      if (this.previous().type === TokenType.SEMICOLON) return;
      
      switch (this.peek().type) {
        case TokenType.IDENTIFIER:
        case TokenType.IF:
        case TokenType.LPAREN:
          return;
      }
      
      this.advance();
    }
  }
}
```

### 11. Quantity Parsing

Quantities in FHIRPath consist of a number followed by an optional unit:

```typescript
// Grammar: quantity := NUMBER unit?
// unit := dateTimePrecision | pluralDateTimePrecision | STRING

private parseQuantity(numberToken: Token): LiteralNode {
  const value = parseFloat(numberToken.value);
  
  // Check if followed by a unit
  const nextToken = this.peek();
  let unit: string | undefined;
  
  // Check for time unit keywords
  if (nextToken.type === TokenType.UNIT) {
    unit = this.advance().value;
  }
  // Check for UCUM unit (string literal)
  else if (nextToken.type === TokenType.STRING) {
    unit = this.advance().value;
  }
  // Check for identifier that could be a unit (like 'mg')
  else if (nextToken.type === TokenType.IDENTIFIER && this.isValidUnit(nextToken.value)) {
    unit = this.advance().value;
  }
  
  return {
    type: 'literal',
    valueType: 'quantity',
    value: value,
    unit: unit
  };
}

private isValidUnit(identifier: string): boolean {
  // Common units that might appear as identifiers
  const commonUnits = ['mg', 'kg', 'ml', 'cm', 'm', 's', 'min', 'h', 'd'];
  return commonUnits.includes(identifier.toLowerCase());
}
```

**Examples:**
- `5 days` - time unit
- `80 'kg'` - UCUM unit as string
- `100 mg` - common unit as identifier

### 12. Error Cases and Validation

The parser must handle and provide clear errors for these cases:

#### 12.1 Semantic Validation

```typescript
// All semantic validation happens in the evaluator, not the parser
// Parser only handles syntax errors
```

#### 12.2 Type Expression Errors

```typescript
// Type names must be valid identifiers
private parseTypeSpecifier(): string[] {
  const parts = [this.parseIdentifier()];
  
  while (this.match(TokenType.DOT)) {
    if (!this.check(TokenType.IDENTIFIER)) {
      throw this.error("Expected type name after '.'");
    }
    parts.push(this.parseIdentifier());
  }
  
  return parts;
}
```

#### 12.3 Syntax Errors

```typescript
// Common syntax errors with helpful messages
private parseExpression(): SExpression {
  // Empty expression
  if (this.isAtEnd()) {
    throw this.error("Unexpected end of expression");
  }
  
  // Invalid operator sequence
  if (this.match(TokenType.AND, TokenType.OR)) {
    throw this.error(`Unexpected operator '${this.previous().value}' at start of expression`);
  }
  
  // Missing closing parenthesis/bracket
  // Track opening delimiters for better errors
}
```

#### 12.4 Error Recovery

```typescript
// Synchronize after parse error to continue checking
private synchronize(): void {
  while (!this.isAtEnd()) {
    // Skip to next likely statement boundary
    if (this.match(TokenType.COMMA, TokenType.RPAREN, TokenType.RBRACKET)) {
      return;
    }
    this.advance();
  }
}
```

### 13. Implementation Structure

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

## Implementation Checklist

With this ADR, we now have everything needed to implement the parser:

- ✅ Complete operator precedence table (including xor, implies)
- ✅ All AST node types defined (including UnaryNode for polarity)
- ✅ Implicit $this handling strategy
- ✅ List of iterative functions that change context
- ✅ Special function handling (iif, defineVariable, standalone functions)
- ✅ Context-sensitive keyword handling
- ✅ Helper method definitions
- ✅ Quantity parsing with units
- ✅ Error handling and recovery strategies
- ✅ Complete examples for all major constructs

The parser is ready for implementation following the Pratt parsing approach outlined in this document.