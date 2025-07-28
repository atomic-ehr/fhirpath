# Parser2 LSP Enhancement Plan - Minimal Shared Implementation

## Executive Summary

This plan outlines a minimal, practical approach to add LSP support by sharing 70-80% of code between the performance-optimized parser2 and a new LSP parser. By using inheritance-based sharing, we maintain parser2's blazing performance (1.2M expr/sec) while adding rich IDE features.

## Shared Components Analysis

### What Can Be Shared (70-80%)


#### 1. **Lexer2 - 100% Reusable**
```typescript
// Already supports LSP needs
const lexer = new Lexer(input, { 
  preserveTrivia: true,      // For LSP
  skipWhitespace: false,     // For parser2
});
```
- Bit-packed TokenType enum
- High-performance character lookup tables
- Position tracking
- Channel support for hidden tokens

#### 2. **Core Parsing Logic**
- Precedence climbing algorithm
- Operator precedence extraction (`type >>> 8`)
- Expression parsing patterns
- Primary expression recognition
- Token navigation methods

#### 3. **Enums and Constants**
- TokenType (bit-packed with precedence)
- NodeType (can be extended)
- Precedence values
- Token classification helpers

### What Needs to Be Different (20-30%)

#### 1. **Node Creation**
```typescript
// parser2 - Minimal nodes
{ type, position }

// parser-lsp - Rich nodes  
{ type, range, parent, id, raw, trivia }
```

#### 2. **Error Handling**
```typescript
// parser2
throw new Error(message);  // Fail fast

// parser-lsp
return createErrorNode(message);  // Recover and continue
```

#### 3. **Parse Result**
```typescript
// parser2
parse(): ASTNode

// parser-lsp
parse(): { ast, errors, indexes }
```

## Implementation Strategy

### Phase 1: Create Base Parser Abstraction (Week 1)

Extract shared logic into an abstract base class:

```typescript
// src/parser2/base-parser.ts
export abstract class BaseParser {
  protected lexer: Lexer;
  protected tokens: Token[] = [];
  protected current = 0;
  
  constructor(input: string, lexerOptions?: LexerOptions) {
    this.lexer = new Lexer(input, lexerOptions);
    this.tokens = this.lexer.tokenize();
  }
  
  // Shared parsing logic
  protected parseExpressionWithPrecedence(minPrecedence: number): any {
    let left = this.parsePrimary();
    
    while (this.current < this.tokens.length) {
      const token = this.tokens[this.current];
      if (!token || token.type === TokenType.EOF) break;
      
      const precedence = this.getPrecedence(token.type);
      if (precedence < minPrecedence) break;
      
      // Delegate node creation to subclass
      left = this.parseOperator(left, token, precedence);
    }
    
    return left;
  }
  
  // Shared utilities
  protected getPrecedence(type: TokenType): number {
    return type >>> 8;
  }
  
  protected peek(): Token {
    return this.tokens[this.current] || this.createEOFToken();
  }
  
  protected advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }
  
  // Abstract methods for subclasses
  abstract createNode(type: NodeType, props: any): any;
  abstract handleError(message: string, token?: Token): any;
  abstract parseOperator(left: any, token: Token, precedence: number): any;
  
  // More shared methods...
}
```

### Phase 2: Adapt Parser2 to Use Base (Week 1)

Minimal changes to existing parser:

```typescript
// src/parser2/index.ts
export class Parser extends BaseParser {
  constructor(input: string) {
    super(input, { skipWhitespace: true, skipComments: true });
  }
  
  parse(): ASTNode {
    const expr = this.expression();
    if (!this.isAtEnd()) {
      this.handleError(`Unexpected token: ${this.lexer.getTokenValue(this.peek())}`);
    }
    return expr;
  }
  
  protected createNode(type: NodeType, props: any): ASTNode {
    // Minimal node creation - same as current
    switch (type) {
      case NodeType.Binary:
        return {
          type,
          position: this.getPosition(props.token),
          operator: props.operator,
          left: props.left,
          right: props.right
        };
      // ... other node types
    }
  }
  
  protected handleError(message: string): never {
    throw new Error(message);  // Maintain fail-fast behavior
  }
  
  // Existing parser-specific methods remain unchanged
}
```

### Phase 3: Implement LSP Parser (Week 2)

New parser with rich features:

```typescript
// src/parser-lsp/index.ts
export interface LSPASTNode extends ASTNode {
  id: string;
  range: Range;
  parent?: LSPASTNode;
  raw?: string;
  leadingTrivia?: Token[];
  trailingTrivia?: Token[];
}

export class LSPParser extends BaseParser {
  private nodeIdCounter = 0;
  private errors: ParseError[] = [];
  private currentParent: LSPASTNode | null = null;
  private nodeIndex = new Map<string, LSPASTNode>();
  
  constructor(input: string) {
    super(input, { preserveTrivia: true });
  }
  
  parse(): LSPParseResult {
    try {
      const ast = this.expression();
      return {
        ast,
        errors: this.errors,
        indexes: this.buildIndexes(ast)
      };
    } catch (error) {
      // Even on fatal error, return partial results
      return {
        ast: this.createErrorNode('Failed to parse', this.peek()),
        errors: [...this.errors, error],
        indexes: this.nodeIndex
      };
    }
  }
  
  protected createNode(type: NodeType, props: any): LSPASTNode {
    const node: LSPASTNode = {
      type,
      id: `node_${this.nodeIdCounter++}`,
      range: this.createRange(props.startToken, props.endToken),
      position: this.getPosition(props.startToken),
      parent: this.currentParent,
      raw: this.extractRaw(props.startToken, props.endToken),
      leadingTrivia: this.collectLeadingTrivia(props.startToken),
      trailingTrivia: this.collectTrailingTrivia(props.endToken)
    };
    
    // Add type-specific properties
    Object.assign(node, this.getNodeProperties(type, props));
    
    // Index the node
    this.nodeIndex.set(node.id, node);
    
    return node;
  }
  
  protected handleError(message: string, token?: Token): LSPASTNode {
    const error: ParseError = {
      message,
      position: token ? this.getPosition(token) : this.getCurrentPosition(),
      token
    };
    this.errors.push(error);
    
    // Try to recover
    return this.recover(token);
  }
  
  private recover(token?: Token): LSPASTNode {
    // Skip to next synchronization point
    while (!this.isAtEnd() && !this.isSynchronizationToken(this.peek().type)) {
      this.advance();
    }
    
    return this.createErrorNode('Recovered from error', token);
  }
}
```

### Phase 4: Add Error Recovery (Week 3)

Enhance LSP parser with robust error recovery:

```typescript
export class LSPParser extends BaseParser {
  private synchronizationTokens = new Set([
    TokenType.SEMICOLON,
    TokenType.RBRACE,
    TokenType.RPAREN,
    TokenType.COMMA,
    TokenType.EOF
  ]);
  
  protected parseOperator(left: LSPASTNode, token: Token, precedence: number): LSPASTNode {
    try {
      // Try normal parsing
      return super.parseOperator(left, token, precedence);
    } catch (error) {
      // Recover and create partial node
      this.handleError(error.message, token);
      
      // Create error node but continue parsing
      const errorNode = this.createErrorNode('Invalid operator', token);
      errorNode.partial = { left, operator: token.type };
      
      // Skip problematic tokens and continue
      this.synchronize();
      
      return errorNode;
    }
  }
  
  parsePartial(input: string, cursorPosition: number): PartialParseResult {
    // Special mode for incomplete expressions
    this.partialMode = true;
    this.cursorPosition = cursorPosition;
    
    const result = this.parse();
    
    // Find node at cursor
    const nodeAtCursor = this.findNodeAtPosition(result.ast, cursorPosition);
    
    return {
      ...result,
      cursorContext: {
        node: nodeAtCursor,
        expectedTokens: this.getExpectedTokens(nodeAtCursor),
        availableCompletions: this.getCompletions(nodeAtCursor)
      }
    };
  }
}
```

### Phase 5: Testing & Integration (Week 4)

1. **Ensure parser2 remains unchanged**:
   ```typescript
   // Existing tests should pass without modification
   import { Parser } from './parser2';
   const ast = new Parser(expr).parse();  // Works exactly as before
   ```

2. **Add LSP parser tests**:
   ```typescript
   import { LSPParser } from './parser-lsp';
   const result = new LSPParser(expr).parse();
   // Test rich features: positions, error recovery, indexes
   ```

3. **Performance validation**:
   - parser2: Must maintain 1.2M+ expr/sec
   - parser-lsp: Target 200K+ expr/sec

## File Structure

```
src/
├── parser2/
│   ├── base-parser.ts      # New: Shared base class
│   ├── index.ts           # Modified: Extends base
│   └── index.perf.test.ts # Unchanged
├── parser-lsp/
│   ├── index.ts           # New: LSP parser
│   ├── error-recovery.ts  # New: Recovery strategies
│   ├── indexes.ts         # New: AST indexing
│   └── index.test.ts      # New: LSP tests
└── lexer2/
    └── index.ts           # Unchanged: Shared by both
```

## Benefits of This Approach

1. **Minimal Changes**: parser2 only needs to extend BaseParser
2. **Maximum Reuse**: 70-80% code shared
3. **Clean Separation**: LSP features isolated in parser-lsp
4. **Performance Preserved**: No impact on parser2 speed
5. **Maintainable**: Single source of parsing logic
6. **Extensible**: Easy to add more parser variants

## Success Metrics

- [ ] parser2 performance unchanged (1.2M+ expr/sec)
- [ ] LSP parser achieves 200K+ expr/sec
- [ ] 70%+ code reuse between parsers
- [ ] All existing parser2 tests pass
- [ ] LSP parser handles invalid code gracefully
- [ ] Position information accurate to character
- [ ] Error recovery works for common mistakes

## Timeline

- **Week 1**: Extract BaseParser, adapt Parser
- **Week 2**: Implement LSPParser core
- **Week 3**: Add error recovery
- **Week 4**: Testing and optimization

Total: 4 weeks to LSP-compatible parser with minimal disruption.