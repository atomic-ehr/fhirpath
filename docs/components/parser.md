# Parser Component

## Overview

The parser transforms a stream of tokens from the lexer into an Abstract Syntax Tree (AST). It implements a recursive descent parser with operator precedence handling, supporting the full FHIRPath grammar including paths, operators, functions, and literals.

## Architecture

### Core Parser Class
**Location**: [`/src/parser/parser.ts`](../../src/parser/parser.ts)

The `FHIRPathParser` class provides the main parsing functionality:

```typescript
export class FHIRPathParser {
  private tokens: Token[];
  private current: number = 0;
  
  constructor(input: string | Token[]) {
    if (typeof input === 'string') {
      this.tokens = lex(input);  // Uses lexer to tokenize
    } else {
      this.tokens = input;
    }
    this.current = 0;
  }
  
  parse(): ASTNode {
    const ast = this.expression();
    if (!this.isAtEnd()) {
      throw this.error("Unexpected token after expression");
    }
    return ast;
  }
}
```

### AST Node Types
**Location**: [`/src/parser/ast.ts`](../../src/parser/ast.ts)

The parser produces these AST node types:

```typescript
export enum NodeType {
  // Navigation
  Identifier,
  TypeOrIdentifier, // Uppercase identifiers that could be types
  
  // Operators
  Binary,     // All binary operators including dot
  Unary,      // unary +, -, not
  Union,      // | operator (special handling)
  
  // Functions
  Function,   // Function calls
  
  // Literals
  Literal,    // numbers, strings, booleans, dates, null
  Variable,   // $this, $index, $total, %var
  Collection, // {} empty collection or {expr1, expr2, ...}
  
  // Type operations
  MembershipTest, // 'is' operator
  TypeCast,       // 'as' operator
  TypeReference,  // Type name in ofType()
  
  // Special
  Index,      // [] indexing
}

// Example node structures:
export interface BinaryNode extends ASTNode {
  type: NodeType.Binary;
  operator: TokenType;
  operation?: any;     // Operation from registry
  left: ASTNode;
  right: ASTNode;
}

export interface FunctionNode extends ASTNode {
  type: NodeType.Function;
  name: ASTNode;  // Usually an identifier
  arguments: ASTNode[];
  operation?: any;     // Operation from registry
}

export interface IdentifierNode extends ASTNode {
  type: NodeType.Identifier;
  name: string;
}
```

## Parsing Algorithm

### 1. Operator Precedence
**Location**: [`parser.ts`](../../src/parser/parser.ts)

The parser implements operator precedence with a Pratt parser approach:

```typescript
// Precedence levels from FHIRPath spec (comments show parser's internal mapping)
// INVOCATION: 1,      // . (dot), function calls
// POSTFIX: 2,         // [] indexing
// UNARY: 3,           // unary +, -, not
// MULTIPLICATIVE: 4,  // *, /, div, mod
// ADDITIVE: 5,        // +, -, &
// TYPE: 6,            // is, as
// UNION: 7,           // |
// RELATIONAL: 8,      // <, >, <=, >=
// EQUALITY: 9,        // =, ~, !=, !~
// MEMBERSHIP: 10,     // in, contains
// AND: 11,            // and
// OR: 12,             // or, xor
// IMPLIES: 13,        // implies

// The parser maps registry precedence to internal precedence
const precedenceMap: Record<number, number> = {
  1: 13,  // implies - lowest
  2: 12,  // or, xor
  3: 11,  // and
  5: 5,   // additive (+, -, &)
  6: 4,   // multiplicative (*, /, div, mod) and type (is, as)
  8: 8,   // relational (<, >, <=, >=)
  9: 9,   // equality (=, !=, ~, !~)
  10: 10, // membership (in, contains)
  13: 7   // union (|)
};
```

### 2. Expression Parsing
**Location**: [`parser.ts:expression()`](../../src/parser/parser.ts)

The main expression parser using Pratt parsing with precedence:

```typescript
private expression(minPrecedence: number = 14): ASTNode {
  let left = this.primary();
  
  while (!this.isAtEnd()) {
    // Handle postfix operators first
    if (this.check(TokenType.LBRACKET) && minPrecedence >= 2) { // POSTFIX precedence
      left = this.parseIndex(left);
      continue;
    }
    
    // Handle function calls and dot operators
    if (this.check(TokenType.DOT) && minPrecedence >= 1) { // INVOCATION precedence
      const dotToken = this.peek();
      const precedence = this.getPrecedence(dotToken);
      if (precedence > minPrecedence) break;
      
      left = this.parseBinary(left, dotToken, precedence);
      continue;
    }
    
    const token = this.peek();
    const precedence = this.getPrecedence(token);
    
    if (precedence === 0 || precedence > minPrecedence) break;
    
    left = this.parseBinary(left, token, precedence);
  }
  
  return left;
}
```

### 3. Path Expression Parsing (via Binary Dot Operator)
**Location**: [`parser.ts:parseBinary()`](../../src/parser/parser.ts)

Path expressions are handled through the binary dot operator:

```typescript
// Special handling for dot operator (left-associative, pipelines data)
if (op.type === TokenType.DOT) {
  // After a dot, we need to handle keywords that can be method names
  let right: ASTNode;
  
  // Check if next token is a keyword that can be used as a method name
  const next = this.peek();
  if (this.isOperatorKeyword(next.type)) {
    // Treat keyword as identifier
    this.advance();
    right = {
      type: NodeType.Identifier,
      name: next.value,
      position: next.position
    } as IdentifierNode;
  } else {
    right = this.primary();
  }
  
  // Check for function call after dot
  if (this.peek().type === TokenType.LPAREN) {
    const dotNode: BinaryNode = {
      type: NodeType.Binary,
      operator: TokenType.DOT,
      operation: operation,
      left: left,
      right: right,
      position: op.position
    };
    return this.functionCall(dotNode);
  }
  
  return {
    type: NodeType.Binary,
    operator: TokenType.DOT,
    operation: operation,
    left: left,
    right: right,
    position: op.position
  } as BinaryNode;
}
```

The dot operator creates a binary node that represents member access or method calls.

### 4. Function Parsing
**Location**: [`parser.ts:functionCall()`](../../src/parser/parser.ts)

Parses function calls with arguments:

```typescript
private functionCall(func: ASTNode): ASTNode {
  this.consume(TokenType.LPAREN, "Expected '(' after function");
  
  const args: ASTNode[] = [];
  
  if (!this.check(TokenType.RPAREN)) {
    do {
      args.push(this.expression());
    } while (this.match(TokenType.COMMA));
  }
  
  this.consume(TokenType.RPAREN, "Expected ')' after arguments");
  
  let result: ASTNode = {
    type: NodeType.Function,
    name: func,
    arguments: args,
    position: func.position
  } as FunctionNode;
  
  // Check for method calls after the function (e.g., exists().not())
  while (this.check(TokenType.DOT)) {
    const dotToken = this.advance();
    
    // After a dot, handle keywords that can be method names
    let right: ASTNode;
    const next = this.peek();
    if (this.isOperatorKeyword(next.type)) {
      // Treat keyword as identifier
      this.advance();
      right = {
        type: NodeType.Identifier,
        name: next.value,
        position: next.position
      } as IdentifierNode;
    } else {
      right = this.primary();
    }
    
    // Continue chaining...
  }
  
  return result;
}
```

The function takes an AST node (usually an identifier) as the function name, allowing for complex function expressions.

### 5. Literal Parsing
**Location**: [`parser.ts:primary()`](../../src/parser/parser.ts)

Handles various literal types in the primary expression parser:

```typescript
// Numbers
if (this.match(TokenType.NUMBER)) {
  const token = this.previous();
  return {
    type: NodeType.Literal,
    value: parseFloat(token.value),
    valueType: 'number',
    position: token.position
  } as LiteralNode;
}

// Strings
if (this.match(TokenType.STRING)) {
  const token = this.previous();
  return {
    type: NodeType.Literal,
    value: token.value,
    valueType: 'string',
    position: token.position
  } as LiteralNode;
}

// Booleans
if (this.match(TokenType.TRUE, TokenType.FALSE)) {
  const token = this.previous();
  return {
    type: NodeType.Literal,
    value: token.type === TokenType.TRUE,
    valueType: 'boolean',
    position: token.position
  } as LiteralNode;
}

// Null literal (empty set {})
if (this.match(TokenType.NULL)) {
  return {
    type: NodeType.Literal,
    value: null,
    valueType: 'null',
    position: this.previous().position
  } as LiteralNode;
}

// Date/Time literals
if (this.match(TokenType.DATE, TokenType.DATETIME, TokenType.TIME)) {
  const token = this.previous();
  return {
    type: NodeType.Literal,
    value: token.value,
    valueType: token.type === TokenType.DATE ? 'date' : 
               token.type === TokenType.TIME ? 'time' : 'datetime',
    position: token.position
  } as LiteralNode;
}

// Variables ($this, $index, $total, %env)
if (this.match(TokenType.THIS, TokenType.INDEX, TokenType.TOTAL, TokenType.ENV_VAR)) {
  return {
    type: NodeType.Variable,
    name: this.previous().value,
    position: this.previous().position
  } as VariableNode;
}
```

## Error Handling

### Error Reporting
**Location**: [`parser.ts:error()`](../../src/parser/parser.ts)

Provides detailed error messages with position information:

```typescript
export class ParseError extends Error {
  constructor(
    message: string,
    public position: Position,
    public token: Token
  ) {
    super(message);
  }
}

private error(message: string): ParseError {
  const pos = this.peek().position;
  const fullMessage = `${message} at line ${pos.line}, column ${pos.column}`;
  return new ParseError(fullMessage, pos, this.peek());
}
```

The parser throws errors immediately upon encountering invalid syntax, providing clear error messages with line and column information.

## AST Pretty Printing
**Location**: [`/src/parser/pprint.ts`](../../src/parser/pprint.ts)

Utility for debugging and visualization using S-expressions:

```typescript
export function pprint(node: ASTNode, multiline: boolean = false, indent: number = 0): string {
  const spaces = multiline ? ' '.repeat(indent) : '';
  const nl = multiline ? '\n' : '';
  const childIndent = indent + 2;
  
  switch (node.type) {
    case NodeType.Literal:
      const lit = node as LiteralNode;
      return `${spaces}(${pprintLiteralValue(lit)}:${lit.valueType})`;
    
    case NodeType.Identifier:
      return `${spaces}(${(node as IdentifierNode).name}:id)`;
    
    case NodeType.Variable:
      const varNode = node as VariableNode;
      const varName = varNode.name.startsWith('$') ? varNode.name : `%${varNode.name}`;
      return `${spaces}(${varName}:var)`;
    
    case NodeType.Binary:
      const binary = node as BinaryNode;
      const op = tokenToOp(binary.operator);
      if (multiline) {
        return `${spaces}(${op}${nl}` +
               `${pprint(binary.left, multiline, childIndent)}${nl}` +
               `${pprint(binary.right, multiline, childIndent)})`;
      } else {
        return `(${op} ${pprint(binary.left)} ${pprint(binary.right)})`;
      }
    
    case NodeType.Function:
      const func = node as FunctionNode;
      const funcName = func.name.type === NodeType.Identifier 
        ? (func.name as IdentifierNode).name 
        : pprint(func.name);
      // ... handle function printing
    
    // ... other node types
  }
}
```

The pretty printer outputs compact S-expression format for easy debugging of AST structures.

## Usage Example

```typescript
import { FHIRPathParser } from '../parser/parser';
import { pprint } from '../parser/pprint';

const expression = "Patient.name.where(use = 'official').given.first()";
const parser = new FHIRPathParser(expression);
const ast = parser.parse();

console.log(pprint(ast));
// Output (S-expression format):
// (. (. (. (. (Patient:id) (name:id)) (where (= (use:id) ('official':string)))) (given:id)) (first))

// With multiline pretty printing:
console.log(pprint(ast, true));
// Output:
// (.
//   (.
//     (.
//       (.
//         (Patient:id)
//         (name:id))
//       (where
//         (=
//           (use:id)
//           ('official':string))))
//     (given:id))
//   (first))
```

## Integration Points

### With Lexer
The parser consumes tokens produced by the lexer, expecting:
- Properly classified token types
- Accurate position information
- EOF token at the end

### With Analyzer
The parser produces AST nodes that include:
- Type hints for the analyzer
- Position information for error reporting
- Structural information for type inference

### With Interpreter/Compiler
The AST nodes are designed for efficient traversal:
- Consistent node structure
- Clear parent-child relationships
- No circular references

## Performance Considerations

1. **Single Pass**: The parser completes in a single pass without backtracking
2. **Minimal Lookahead**: Most parsing decisions require only one token lookahead
3. **Direct Construction**: AST nodes are constructed directly without intermediate representations
4. **Memory Efficiency**: Shared position objects and interned strings from the lexer