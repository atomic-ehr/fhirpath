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

Note: The lexer needs to provide these additional tokens:
- NOT for the 'not' operator
- LBRACE and RBRACE for collection literals {}
- Proper handling of all special variables ($this, $index, $total)

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

interface TypeOrIdentifierNode extends ASTNode {
  type: NodeType.TypeOrIdentifier;
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

interface UnionNode extends ASTNode {
  type: NodeType.Union;
  operands: ASTNode[];
}

interface MembershipTestNode extends ASTNode {
  type: NodeType.MembershipTest;
  expression: ASTNode;
  targetType: string;
}

interface TypeCastNode extends ASTNode {
  type: NodeType.TypeCast;
  expression: ASTNode;
  targetType: string;
}

interface CollectionNode extends ASTNode {
  type: NodeType.Collection;
  elements: ASTNode[];
}

interface TypeReferenceNode extends ASTNode {
  type: NodeType.TypeReference;
  typeName: string;
}

// Node types
enum NodeType {
  // Navigation
  Identifier,
  TypeOrIdentifier, // Uppercase identifiers that could be types (Patient, Observation)
  
  // Operators
  Binary,     // All binary operators including dot
  Unary,      // unary +, -, not
  Union,      // | operator (special handling for multiple operands)
  
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
```

### Precedence Table

```typescript
const PRECEDENCE = {
  // Highest to lowest (matching spec numbering)
  INVOCATION: 1,      // . (dot), function calls
  POSTFIX: 2,         // [] indexing
  UNARY: 3,           // unary +, -, not
  MULTIPLICATIVE: 4,  // *, /, div, mod
  ADDITIVE: 5,        // +, -, &
  TYPE: 6,            // is, as
  UNION: 7,           // |
  RELATIONAL: 8,      // <, >, <=, >=
  EQUALITY: 9,        // =, ~, !=, !~
  MEMBERSHIP: 10,     // in, contains
  AND: 11,            // and
  OR: 12,             // or, xor
  IMPLIES: 13,        // implies
};
```

### Parser Structure

```typescript
class FHIRPathParser {
  private tokens: Token[];
  private current: number = 0;
  
  constructor(input: string | Token[]) {
    if (typeof input === 'string') {
      this.tokens = lex(input);  // Assuming lex function from lexer
    } else {
      this.tokens = input;
    }
    this.current = 0;
  }
  
  // Main entry point
  parse(): ASTNode {
    const ast = this.expression();
    if (!this.isAtEnd()) {
      throw this.error("Unexpected token after expression");
    }
    return ast;
  }
  
  // Pratt parser for expressions
  private expression(minPrecedence: number = 0): ASTNode {
    let left = this.primary();
    
    while (!this.isAtEnd()) {
      // Handle postfix operators first
      if (this.check(TokenType.LBRACKET) && minPrecedence <= PRECEDENCE.POSTFIX) {
        left = this.parseIndex(left);
        continue;
      }
      
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
    if (this.match(TokenType.PLUS, TokenType.MINUS, TokenType.NOT)) {
      const op = this.previous();
      const right = this.expression(PRECEDENCE.UNARY);
      return {
        type: NodeType.Unary,
        operator: op.type,
        operand: right,
        position: op.position
      };
    }
    
    // Handle empty collection {} or collection literals {expr1, expr2, ...}
    if (this.match(TokenType.LBRACE)) {
      const elements: ASTNode[] = [];
      
      if (!this.check(TokenType.RBRACE)) {
        do {
          elements.push(this.expression());
        } while (this.match(TokenType.COMMA));
      }
      
      this.consume(TokenType.RBRACE, "Expected '}' after collection elements");
      return {
        type: NodeType.Collection,
        elements: elements,
        position: this.previous().position
      };
    }
    
    throw this.error("Expected expression");
  }
  
  // Parse binary operators with precedence
  private parseBinary(left: ASTNode, op: Token, precedence: number): ASTNode {
    // Special handling for type operators
    if (op.type === TokenType.IS || op.type === TokenType.AS) {
      this.advance(); // consume operator
      
      // Type name is an identifier, not an expression
      const typeName = this.consume(TokenType.IDENTIFIER, "Expected type name").value;
      
      return {
        type: op.type === TokenType.IS ? NodeType.MembershipTest : NodeType.TypeCast,
        expression: left,
        targetType: typeName,
        position: op.position
      } as MembershipTestNode | TypeCastNode;
    }
    
    this.advance(); // consume operator
    
    // Special handling for union operator - can chain multiple
    if (op.type === TokenType.PIPE) {
      const right = this.expression(precedence + 1);
      
      // If left is already a union, add to it
      if (left.type === NodeType.Union) {
        (left as UnionNode).operands.push(right);
        return left;
      }
      
      // Create new union node
      return {
        type: NodeType.Union,
        operands: [left, right],
        position: op.position
      };
    }
    
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
  
  private identifierOrFunctionCall(): ASTNode {
    const name = this.previous().value;
    const position = this.previous().position;
    
    // Check if identifier starts with uppercase (potential type)
    const isUpperCase = name[0] === name[0].toUpperCase() && name[0] !== name[0].toLowerCase();
    
    const identifier: IdentifierNode | TypeOrIdentifierNode = isUpperCase ? {
      type: NodeType.TypeOrIdentifier,
      name: name,
      position: position
    } : {
      type: NodeType.Identifier,
      name: name,
      position: position
    };
    
    // Check for function call
    if (this.check(TokenType.LPAREN)) {
      // Special handling for ofType(TypeName)
      if (identifier.name === 'ofType') {
        return this.parseOfType();
      }
      return this.functionCall(identifier);
    }
    
    return identifier;
  }
  
  private parseOfType(): ASTNode {
    this.consume(TokenType.LPAREN, "Expected '(' after ofType");
    const typeName = this.consume(TokenType.IDENTIFIER, "Expected type name").value;
    this.consume(TokenType.RPAREN, "Expected ')' after type name");
    
    return {
      type: NodeType.Function,
      name: {
        type: NodeType.Identifier,
        name: 'ofType',
        position: this.previous().position
      },
      arguments: [{
        type: NodeType.TypeReference,
        typeName: typeName,
        position: this.previous().position
      }],
      position: this.previous().position
    };
  }
  
  // Precedence lookup (high precedence = low number)
  private getPrecedence(token: Token): number {
    switch (token.type) {
      case TokenType.DOT: return 1;           // Highest precedence
      // Indexing is postfix, handled separately
      // Unary operators handled in primary()
      case TokenType.STAR:
      case TokenType.SLASH:
      case TokenType.DIV:
      case TokenType.MOD: return 4;
      case TokenType.PLUS:
      case TokenType.MINUS:
      case TokenType.CONCAT: return 5;
      case TokenType.IS:
      case TokenType.AS: return 6;
      case TokenType.PIPE: return 7;
      case TokenType.LT:
      case TokenType.GT:
      case TokenType.LTE:
      case TokenType.GTE: return 8;
      case TokenType.EQ:
      case TokenType.NEQ:
      case TokenType.EQUIV:
      case TokenType.NEQUIV: return 9;
      case TokenType.IN:
      case TokenType.CONTAINS: return 10;
      case TokenType.AND: return 11;
      case TokenType.OR:
      case TokenType.XOR: return 12;
      case TokenType.IMPLIES: return 13;      // Lowest precedence
      default: return 0;
    }
  }
  
  // Helper methods
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
  
  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }
  
  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }
  
  private peek(): Token {
    return this.tokens[this.current];
  }
  
  private previous(): Token {
    return this.tokens[this.current - 1];
  }
  
  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw this.error(message);
  }
  
  private error(message: string): ParseError {
    const pos = this.peek().position;
    const fullMessage = `${message} at line ${pos.line}, column ${pos.column}`;
    return new ParseError(fullMessage, pos, this.peek());
  }
  
  private isRightAssociative(op: Token): boolean {
    // FHIRPath doesn't have right-associative operators
    return false;
  }
}
```

### Key Design Decisions

1. **Clean AST Structure**: Each node type has specific fields for its purpose
2. **Pratt Parsing**: Handles complex precedence elegantly without deeply nested code
3. **Operator as Token Type**: Binary nodes store the operator as TokenType for later interpretation
4. **Special Dot Handling**: Dot operator is treated specially for proper left-to-right parsing
5. **Expression Arguments**: Functions store expression ASTs for later evaluation with proper context
6. **Special Function Handling**: ofType() takes type references, not expressions
7. **Type/Identifier Distinction**: Uppercase identifiers are parsed as TypeOrIdentifier nodes

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

## Performance Considerations

### Algorithmic Complexity
- **Time Complexity**: O(n) where n is the number of tokens
- **Space Complexity**: O(d) for parse stack depth, O(n) for AST nodes
- **No Backtracking**: Pratt parsing avoids expensive backtracking

### Memory Optimizations

1. **AST Node Pooling**
```typescript
class ASTNodePool {
  private pools: Map<NodeType, ASTNode[]> = new Map();
  
  acquire<T extends ASTNode>(type: NodeType): T {
    const pool = this.pools.get(type) || [];
    return (pool.pop() || {}) as T;
  }
  
  release(node: ASTNode): void {
    // Clear node references
    Object.keys(node).forEach(key => {
      if (key !== 'type') delete node[key];
    });
    
    const pool = this.pools.get(node.type) || [];
    pool.push(node);
    this.pools.set(node.type, pool);
  }
}
```

2. **String Interning**
```typescript
private internedStrings = new Map<string, string>();

private intern(str: string): string {
  const existing = this.internedStrings.get(str);
  if (existing) return existing;
  this.internedStrings.set(str, str);
  return str;
}
```

3. **Lazy Position Tracking**
- Only store start position, calculate end when needed
- Reduces Position object allocations by 50%

### Parsing Optimizations

1. **Common Pattern Fast Paths**
```typescript
// Fast path for simple navigation chains: Patient.name.given
private tryParseNavigationChain(): ASTNode | null {
  if (!this.check(TokenType.IDENTIFIER)) return null;
  
  let left = this.identifierOrFunctionCall();
  
  while (this.match(TokenType.DOT)) {
    if (!this.check(TokenType.IDENTIFIER)) {
      // Fall back to general parsing
      this.current--; // backtrack one token
      return null;
    }
    const right = this.identifierOrFunctionCall();
    left = this.createBinaryNode(TokenType.DOT, left, right);
  }
  
  return left;
}
```

2. **Precedence Table as Array**
```typescript
// Faster than switch statement for hot path
private static readonly PRECEDENCE_TABLE: number[] = (() => {
  const table = new Array(TokenType.MAX_VALUE).fill(0);
  table[TokenType.DOT] = 1;
  table[TokenType.STAR] = 4;
  table[TokenType.SLASH] = 4;
  // ... etc
  return table;
})();

private getPrecedence(token: Token): number {
  return FHIRPathParser.PRECEDENCE_TABLE[token.type] || 0;
}
```

3. **Inline Hot Functions**
```typescript
// Inline these for better performance
private check(type: TokenType): boolean {
  return this.current < this.tokens.length && 
         this.tokens[this.current].type === type;
}

private advance(): Token {
  return this.tokens[this.current++];
}
```

### Streaming Considerations

For large expressions or real-time parsing:

1. **Incremental Parsing**
```typescript
interface IncrementalParser {
  // Parse up to a complete expression
  parseNext(): ASTNode | null;
  // Check if more input available
  hasMore(): boolean;
}
```

2. **AST Visitor Pattern** - Avoid building full AST for analysis
```typescript
interface ASTVisitor {
  visitIdentifier(node: IdentifierNode): void;
  visitBinary(node: BinaryNode): void;
  // ... etc
}
```

### Benchmarking Targets

Based on typical FHIRPath usage patterns:

1. **Simple Navigation**: `Patient.name.given` - Should parse in < 1ms
2. **Complex Queries**: `Bundle.entry.resource.where(...)` - Should parse in < 5ms  
3. **Memory Usage**: < 1KB per 100 tokens
4. **Common Patterns**:
   - Navigation chains: 70% of expressions
   - Where clauses: 20% of expressions
   - Complex functions: 10% of expressions


## Consequences

### Positive

- **Clean Separation**: Pratt parsing handles precedence, recursive descent handles structure
- **Clean AST**: AST nodes are simple data structures ready for evaluation phase
- **Efficient**: O(n) parsing with minimal backtracking
- **Extensible**: Easy to add new operators with precedence
- **Good Error Messages**: Position tracking from lexer enables precise error reporting
- **Supports Streaming**: Parser can build AST incrementally
- **Performance**: Fast paths for common patterns, minimal allocations

### Negative

- **Two Techniques**: Developers need to understand both recursive descent and Pratt parsing
- **Complex Precedence**: 13 levels of precedence require careful implementation
- **Special Cases**: Dot operator and function evaluation need special handling
- **Memory Usage**: Full AST construction (could be optimized with streaming evaluation)
- **Optimization Complexity**: Performance optimizations add code complexity

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
8. Add collection literal parsing
9. Add not operator support
10. Implement error recovery and reporting
11. Add comprehensive tests for precedence and associativity
12. Optimize for common patterns (navigation chains)

## Example AST Output

Input: `Patient.name.where(use = 'official').given`

AST:
```typescript
{
  type: NodeType.Binary,
  operator: TokenType.DOT,
  left: {
    type: NodeType.Function,
    name: {
      type: NodeType.Binary,
      operator: TokenType.DOT,
      left: {
        type: NodeType.Binary,
        operator: TokenType.DOT,
        left: { type: NodeType.TypeOrIdentifier, name: "Patient" },
        right: { type: NodeType.Identifier, name: "name" }
      },
      right: { type: NodeType.Identifier, name: "where" }
    },
    arguments: [{
      type: NodeType.Binary,
      operator: TokenType.EQ,
      left: { type: NodeType.Identifier, name: "use" },
      right: { type: NodeType.Literal, value: "official", valueType: "string" }
    }]
  },
  right: { type: NodeType.Identifier, name: "given" }
}
```

## Usage Example

```typescript
import { FHIRPathParser } from './parser';
import { lex } from './lexer';

// Parse from string
const parser = new FHIRPathParser("Patient.name.given");
const ast = parser.parse();

// Parse from tokens (for reuse)
const tokens = lex("Patient.name.given");
const parser2 = new FHIRPathParser(tokens);
const ast2 = parser2.parse();

// With error handling
try {
  const ast = new FHIRPathParser("invalid expression {{").parse();
} catch (e) {
  if (e instanceof ParseError) {
    console.error(`Parse error: ${e.message}`);
    console.error(`At position: ${e.position.line}:${e.position.column}`);
  }
}
```

## Testing Strategy

1. **Precedence Tests**: Ensure correct parsing order for all 13 levels
2. **Edge Cases**: Empty input, single tokens, deeply nested expressions
3. **Error Cases**: Invalid syntax, unexpected tokens, missing closing brackets
4. **Performance Tests**: Measure against benchmarking targets
5. **Regression Tests**: Common FHIRPath patterns from real usage

## References

- [Simple but Powerful Pratt Parsing](https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html)
- [FHIRPath Specification - Operator Precedence](https://hl7.org/fhirpath/#operator-precedence)
- Our FHIRPath mental model document (./ideas/fhirpath-mental-model-3.md)