# ADR-002: Recursive Descent Pratt Parser for FHIRPath

## Status

Proposed

## Context

Based on our FHIRPath mental model (processing nodes with uniform interface) and existing lexer implementation, we need a parser that can:

1. Handle FHIRPath's 13 levels of operator precedence efficiently
2. Support the two-phase evaluation model (control flow down, data flow up)
3. Build an AST where every node shares the same interface (input/context → output/new context)
4. Handle both left-associative operators (., most binary operators) and special evaluation rules (iterators, conditionals)
5. Parse complex expressions with mixed operators, function calls, and navigation

The existing lexer already provides:
- Clean token stream with all FHIRPath tokens
- Proper handling of keywords, operators, literals, and special constructs
- Position tracking for error reporting

## Decision

Implement a **Recursive Descent Pratt Parser** that combines:
- Recursive descent for statement-level parsing (primary expressions, function calls)
- Pratt parsing (operator precedence climbing) for expression parsing

### Parser Architecture

```typescript
// Core AST Node Interface
interface ASTNode {
  type: NodeType;
  position: Position;
}

// Specific node types
interface IdentifierNode extends ASTNode {
  type: NodeType.Identifier;
  name: string;
}

interface LiteralNode extends ASTNode {
  type: NodeType.Literal;
  value: any;
  valueType: 'string' | 'number' | 'boolean' | 'date' | 'time' | 'datetime' | 'null';
}

interface BinaryNode extends ASTNode {
  type: NodeType.Binary;
  operator: TokenType;
  left: ASTNode;
  right: ASTNode;
}

interface UnaryNode extends ASTNode {
  type: NodeType.Unary;
  operator: TokenType;
  operand: ASTNode;
}

interface FunctionNode extends ASTNode {
  type: NodeType.Function;
  name: ASTNode;  // Usually an identifier
  arguments: ASTNode[];
}

interface VariableNode extends ASTNode {
  type: NodeType.Variable;
  name: string;
}

interface IndexNode extends ASTNode {
  type: NodeType.Index;
  expression: ASTNode;
  index: ASTNode;
}

// Node types
enum NodeType {
  // Navigation
  Identifier,
  
  // Operators
  Binary,     // All binary operators including dot
  Unary,      // unary +, -
  
  // Functions
  Function,   // Function calls
  
  // Literals
  Literal,    // numbers, strings, booleans, dates, null
  Variable,   // $this, %var
  
  // Special
  Index,      // [] indexing
}
```

### Precedence Table

```typescript
const PRECEDENCE = {
  // Lowest to highest
  IMPLIES: 1,     // implies
  OR: 2,          // or, xor
  AND: 3,         // and
  MEMBERSHIP: 4,  // in, contains
  EQUALITY: 5,    // =, ~, !=, !~
  RELATIONAL: 6,  // <, >, <=, >=
  UNION: 7,       // |
  TYPE: 8,        // is, as
  ADDITIVE: 9,    // +, -, &
  MULTIPLICATIVE: 10, // *, /, div, mod
  UNARY: 11,      // unary +, -
  POSTFIX: 12,    // [] indexing
  INVOCATION: 13, // . (dot), function calls
};
```

### Parser Structure

```typescript
class FHIRPathParser {
  private tokens: Token[];
  private current: number = 0;
  
  // Main entry point
  parse(): ASTNode {
    return this.expression();
  }
  
  // Pratt parser for expressions
  private expression(minPrecedence: number = 0): ASTNode {
    let left = this.primary();
    
    while (!this.isAtEnd()) {
      const token = this.peek();
      const precedence = this.getPrecedence(token);
      
      if (precedence < minPrecedence) break;
      
      left = this.parseBinary(left, token, precedence);
    }
    
    return left;
  }
  
  // Parse primary expressions (recursive descent)
  private primary(): ASTNode {
    // Handle literals
    if (this.match(TokenType.NUMBER)) {
      const token = this.previous();
      return {
        type: NodeType.Literal,
        value: parseFloat(token.value),
        valueType: 'number',
        position: token.position
      };
    }
    if (this.match(TokenType.STRING)) {
      const token = this.previous();
      return {
        type: NodeType.Literal,
        value: token.value,
        valueType: 'string',
        position: token.position
      };
    }
    if (this.match(TokenType.TRUE, TokenType.FALSE)) {
      const token = this.previous();
      return {
        type: NodeType.Literal,
        value: token.type === TokenType.TRUE,
        valueType: 'boolean',
        position: token.position
      };
    }
    if (this.match(TokenType.NULL)) {
      return {
        type: NodeType.Literal,
        value: null,
        valueType: 'null',
        position: this.previous().position
      };
    }
    
    // Handle variables
    if (this.match(TokenType.THIS)) {
      return {
        type: NodeType.Variable,
        name: '$this',
        position: this.previous().position
      };
    }
    if (this.match(TokenType.ENV_VAR)) {
      return {
        type: NodeType.Variable,
        name: this.previous().value,
        position: this.previous().position
      };
    }
    
    // Handle dates/times
    if (this.match(TokenType.DATE, TokenType.DATETIME, TokenType.TIME)) {
      const token = this.previous();
      return {
        type: NodeType.Literal,
        value: token.value,
        valueType: token.type === TokenType.DATE ? 'date' : 
                   token.type === TokenType.TIME ? 'time' : 'datetime',
        position: token.position
      };
    }
    
    // Handle grouping
    if (this.match(TokenType.LPAREN)) {
      const expr = this.expression();
      this.consume(TokenType.RPAREN, "Expected ')' after expression");
      return expr;
    }
    
    // Handle identifiers (which might be followed by function calls)
    if (this.match(TokenType.IDENTIFIER)) {
      return this.identifierOrFunctionCall();
    }
    
    // Handle delimited identifiers
    if (this.match(TokenType.DELIMITED_IDENTIFIER)) {
      return this.identifierOrFunctionCall();
    }
    
    // Handle unary operators
    if (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const op = this.previous();
      const right = this.expression(PRECEDENCE.UNARY);
      return {
        type: NodeType.Unary,
        operator: op.type,
        operand: right,
        position: op.position
      };
    }
    
    throw this.error("Expected expression");
  }
  
  // Parse binary operators with precedence
  private parseBinary(left: ASTNode, op: Token, precedence: number): ASTNode {
    this.advance(); // consume operator
    
    // Special handling for dot operator (left-associative, pipelines data)
    if (op.type === TokenType.DOT) {
      const right = this.primary();
      
      // Check for function call after dot
      if (this.peek().type === TokenType.LPAREN) {
        const dotNode: BinaryNode = {
          type: NodeType.Binary,
          operator: TokenType.DOT,
          left: left,
          right: right,
          position: op.position
        };
        return this.functionCall(dotNode);
      }
      
      return {
        type: NodeType.Binary,
        operator: TokenType.DOT,
        left: left,
        right: right,
        position: op.position
      };
    }
    
    // Right-associative operators (none in FHIRPath currently)
    const associativity = this.isRightAssociative(op) ? 0 : 1;
    const right = this.expression(precedence + associativity);
    
    return {
      type: NodeType.Binary,
      operator: op.type,
      left: left,
      right: right,
      position: op.position
    };
  }
  
  // Parse function calls
  private functionCall(func: ASTNode): ASTNode {
    this.consume(TokenType.LPAREN, "Expected '(' after function");
    
    const args: ASTNode[] = [];
    
    if (!this.check(TokenType.RPAREN)) {
      do {
        args.push(this.expression());
      } while (this.match(TokenType.COMMA));
    }
    
    this.consume(TokenType.RPAREN, "Expected ')' after arguments");
    
    return {
      type: NodeType.Function,
      name: func,
      arguments: args,
      position: func.position
    };
  }
  
  // Handle indexing
  private parseIndex(expr: ASTNode): ASTNode {
    this.consume(TokenType.LBRACKET, "Expected '['");
    const index = this.expression();
    this.consume(TokenType.RBRACKET, "Expected ']'");
    
    return {
      type: NodeType.Index,
      expression: expr,
      index: index,
      position: expr.position
    };
  }
}
```

### Key Design Decisions

1. **Clean AST Structure**: Each node type has specific fields for its purpose
2. **Pratt Parsing**: Handles complex precedence elegantly without deeply nested code
3. **Operator as Token Type**: Binary nodes store the operator as TokenType for later interpretation
4. **Special Dot Handling**: Dot operator is treated specially for proper left-to-right parsing
5. **Expression Arguments**: Functions store expression ASTs for later evaluation with proper context

### Error Recovery

```typescript
class ParseError extends Error {
  constructor(
    message: string,
    public position: Position,
    public token: Token
  ) {
    super(message);
  }
}

// Synchronization points for error recovery
private synchronize() {
  while (!this.isAtEnd()) {
    if (this.previous().type === TokenType.COMMA) return;
    if (this.previous().type === TokenType.RPAREN) return;
    
    switch (this.peek().type) {
      case TokenType.IDENTIFIER:
      case TokenType.WHERE:
      case TokenType.SELECT:
        return;
    }
    
    this.advance();
  }
}
```

## Consequences

### Positive

- **Clean Separation**: Pratt parsing handles precedence, recursive descent handles structure
- **Clean AST**: AST nodes are simple data structures ready for evaluation phase
- **Efficient**: O(n) parsing with minimal backtracking
- **Extensible**: Easy to add new operators with precedence
- **Good Error Messages**: Position tracking from lexer enables precise error reporting
- **Supports Streaming**: Parser can build AST incrementally

### Negative

- **Two Techniques**: Developers need to understand both recursive descent and Pratt parsing
- **Complex Precedence**: 13 levels of precedence require careful implementation
- **Special Cases**: Dot operator and function evaluation need special handling
- **Memory Usage**: Full AST construction (could be optimized with streaming evaluation)

## Alternatives Considered

### 1. Pure Recursive Descent
- **Pros**: Simpler to understand, single technique
- **Cons**: Deep nesting for precedence, harder to maintain, less efficient

### 2. Parser Combinator
- **Pros**: Composable, type-safe, elegant
- **Cons**: Performance overhead, harder to optimize, less control over error messages

### 3. Grammar-Based Generator (ANTLR/PEG)
- **Pros**: Declarative, handles left-recursion, good tooling
- **Cons**: External dependency, less control, harder to match our exact mental model

### 4. Hand-written Precedence Climbing
- **Pros**: Very efficient, minimal code
- **Cons**: Less readable, harder to extend, mixing concerns

## Implementation Plan

1. Define AST node types matching the processing node mental model
2. Implement basic Pratt parser framework with precedence table
3. Add primary expression parsing (literals, variables, identifiers)
4. Implement binary operator parsing with correct associativity
5. Add special handling for dot operator (pipeline semantics)
6. Implement function call parsing
7. Add indexing and type operators
8. Implement error recovery and reporting
9. Add comprehensive tests for precedence and associativity
10. Optimize for common patterns (navigation chains)

## References

- [Simple but Powerful Pratt Parsing](https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html)
- [FHIRPath Specification - Operator Precedence](https://hl7.org/fhirpath/#operator-precedence)
- Our FHIRPath mental model document (./ideas/fhirpath-mental-model-3.md)