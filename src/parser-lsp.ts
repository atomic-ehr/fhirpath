import { TokenType } from './lexer';
import type { Token } from './lexer';
import { BaseParser, NodeType } from './parser-base';
import type { Position } from './parser-base';
import { registry } from './registry';

// LSP-specific types
export interface Range {
  start: Position;
  end: Position;
}

export interface Trivia {
  type: 'whitespace' | 'comment' | 'lineComment';
  value: string;
  range: Range;
}

// Rich AST node with all LSP requirements
export interface LSPASTNode {
  // Core properties
  id: string;
  type: NodeType | 'Error';
  
  // Rich position information
  range: Range;
  contentRange: Range;
  position: Position; // For compatibility with base parser
  
  // Source preservation
  raw: string;
  leadingTrivia: Trivia[];
  trailingTrivia: Trivia[];
  
  // Bidirectional navigation
  parent: LSPASTNode | null;
  children: LSPASTNode[];
  previousSibling: LSPASTNode | null;
  nextSibling: LSPASTNode | null;
  
  // Navigation helpers
  path: string;
  depth: number;
}

// Specific node types
export interface IdentifierNode extends LSPASTNode {
  type: NodeType.Identifier | NodeType.TypeOrIdentifier;
  name: string;
}

export interface LiteralNode extends LSPASTNode {
  type: NodeType.Literal;
  value: any;
  valueType: 'string' | 'number' | 'boolean' | 'date' | 'time' | 'datetime' | 'null';
}

export interface BinaryNode extends LSPASTNode {
  type: NodeType.Binary;
  operator: string;
  left: LSPASTNode;
  right: LSPASTNode;
}

export interface UnaryNode extends LSPASTNode {
  type: NodeType.Unary;
  operator: string;
  operand: LSPASTNode;
}

export interface FunctionNode extends LSPASTNode {
  type: NodeType.Function;
  name: LSPASTNode;
  arguments: LSPASTNode[];
}

export interface VariableNode extends LSPASTNode {
  type: NodeType.Variable;
  name: string;
}

export interface IndexNode extends LSPASTNode {
  type: NodeType.Index;
  expression: LSPASTNode;
  index: LSPASTNode;
}


export interface MembershipTestNode extends LSPASTNode {
  type: NodeType.MembershipTest;
  expression: LSPASTNode;
  targetType: string;
}

export interface TypeCastNode extends LSPASTNode {
  type: NodeType.TypeCast;
  expression: LSPASTNode;
  targetType: string;
}

export interface CollectionNode extends LSPASTNode {
  type: NodeType.Collection;
  elements: LSPASTNode[];
}

// Error node for recovery
export interface ErrorNode extends LSPASTNode {
  type: 'Error';
  message: string;
  errorCode?: string;
  expectedTokens?: TokenType[];
  actualToken?: Token;
  partialNode?: LSPASTNode;
  recoveryStrategy?: 'skip' | 'insert' | 'replace' | 'synchronize';
}

// Parse result types
export interface ParseError {
  message: string;
  position: Position;
  range?: Range;
  token?: Token;
}

export interface LSPParseResult {
  ast: LSPASTNode;
  errors: ParseError[];
  indexes: {
    nodeById: Map<string, LSPASTNode>;
    nodesByType: Map<NodeType | 'Error', LSPASTNode[]>;
    identifiers: Map<string, LSPASTNode[]>;
  };
}

export interface PartialParseResult extends LSPParseResult {
  cursorContext?: {
    node: LSPASTNode | null;
    expectedTokens: TokenType[];
    availableCompletions: string[];
  };
}

// Create a type that satisfies the BaseParser constraint
type LSPNode = LSPASTNode & { type: NodeType };

export class LSPParser extends BaseParser<LSPNode> {
  private nodeIdCounter = 0;
  private errors: ParseError[] = [];
  private currentParent: LSPASTNode | null = null;
  private nodeIndex = new Map<string, LSPASTNode>();
  private nodesByType = new Map<NodeType | 'Error', LSPASTNode[]>();
  private identifierIndex = new Map<string, LSPASTNode[]>();
  private input: string;
  private partialMode = false;
  private cursorPosition?: number;
  
  // Synchronization tokens for error recovery
  private readonly synchronizationTokens = new Set([
    TokenType.COMMA,
    TokenType.RPAREN,
    TokenType.RBRACE,
    TokenType.RBRACKET,
    TokenType.EOF
  ]);
  
  constructor(input: string) {
    // Enable trivia preservation for LSP features
    super(input, { preserveTrivia: true });
    this.input = input;
  }
  
  parse(): LSPParseResult {
    // Cast is safe because we handle Error nodes separately
    this.errors = [];
    this.nodeIndex.clear();
    this.nodesByType.clear();
    this.identifierIndex.clear();
    
    try {
      // Skip initial whitespace
      this.skipTrivia();
      
      const ast = this.expression();
      
      // Skip trailing whitespace
      this.skipTrivia();
      
      if (!this.isAtEnd()) {
        const token = this.peek();
        this.addError(`Unexpected token: ${token.value}`, token);
      }
      return this.createParseResult(ast as LSPASTNode);
    } catch (error) {
      // Even on fatal error, return partial results
      const errorNode = this.createErrorNode(
        error instanceof Error ? error.message : 'Parse failed',
        this.peek()
      );
      return this.createParseResult(errorNode as LSPASTNode);
    }
  }
  
  parsePartial(cursorPosition: number): PartialParseResult {
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
  
  // Implement abstract methods for node creation
  protected createIdentifierNode(name: string, token: Token): LSPNode {
    const isType = name[0] && name[0] >= 'A' && name[0] <= 'Z';
    const node = this.createNode(
      isType ? NodeType.TypeOrIdentifier : NodeType.Identifier,
      { name },
      token,
      token
    ) as IdentifierNode;
    
    // Don't index yet - wait until node is fully constructed
    // Index will be built when createNode is called
    
    return node;
  }
  
  protected createLiteralNode(value: any, valueType: LiteralNode['valueType'], token: Token): LSPNode {
    return this.createNode(
      NodeType.Literal,
      { value, valueType },
      token,
      token
    ) as LiteralNode;
  }
  
  protected createBinaryNode(token: Token, left: LSPNode, right: LSPNode): LSPNode {
    const startToken = this.findFirstToken(left);
    const endToken = this.findLastToken(right);
    const node = this.createNode(
      NodeType.Binary,
      { operator: token.value, left, right },
      startToken,
      endToken
    ) as BinaryNode;
    
    // Set up parent-child relationships
    this.setParent(left, node);
    this.setParent(right, node);
    node.children = [left, right];
    left.nextSibling = right;
    right.previousSibling = left;
    
    return node;
  }
  
  protected createUnaryNode(token: Token, operand: LSPNode): LSPNode {
    const endToken = this.findLastToken(operand);
    const node = this.createNode(
      NodeType.Unary,
      { operator: token.value, operand },
      token,
      endToken
    ) as UnaryNode;
    
    this.setParent(operand, node);
    node.children = [operand];
    
    return node;
  }
  
  protected createFunctionNode(name: LSPNode, args: LSPNode[], position: Position): LSPNode {
    const startToken = this.findFirstToken(name);
    const endToken = args.length > 0 ? this.findLastToken(args[args.length - 1]!) : this.previous();
    const node = this.createNode(
      NodeType.Function,
      { name, arguments: args },
      startToken,
      endToken
    ) as FunctionNode;
    
    this.setParent(name, node);
    node.children = [name, ...args];
    
    // Set up sibling relationships
    let prev = name;
    for (const arg of args) {
      this.setParent(arg, node);
      prev.nextSibling = arg;
      arg.previousSibling = prev;
      prev = arg;
    }
    
    return node;
  }
  
  protected createVariableNode(name: string, token: Token): LSPNode {
    return this.createNode(
      NodeType.Variable,
      { name },
      token,
      token
    ) as VariableNode;
  }
  
  protected createIndexNode(expression: LSPNode, index: LSPNode, position: Position): LSPNode {
    const startToken = this.findFirstToken(expression);
    const endToken = this.previous(); // Should be RBRACKET
    const node = this.createNode(
      NodeType.Index,
      { expression, index },
      startToken,
      endToken
    ) as IndexNode;
    
    this.setParent(expression, node);
    this.setParent(index, node);
    node.children = [expression, index];
    expression.nextSibling = index;
    index.previousSibling = expression;
    
    return node;
  }
  
  
  protected createMembershipTestNode(expression: LSPNode, targetType: string, position: Position): LSPNode {
    const startToken = this.findFirstToken(expression);
    const endToken = this.previous(); // Should be type identifier
    const node = this.createNode(
      NodeType.MembershipTest,
      { expression, targetType },
      startToken,
      endToken
    ) as MembershipTestNode;
    
    this.setParent(expression, node);
    node.children = [expression];
    
    return node;
  }
  
  protected createTypeCastNode(expression: LSPNode, targetType: string, position: Position): LSPNode {
    const startToken = this.findFirstToken(expression);
    const endToken = this.previous(); // Should be type identifier
    const node = this.createNode(
      NodeType.TypeCast,
      { expression, targetType },
      startToken,
      endToken
    ) as TypeCastNode;
    
    this.setParent(expression, node);
    node.children = [expression];
    
    return node;
  }
  
  protected createCollectionNode(elements: LSPNode[], position: Position): LSPNode {
    const startToken = this.tokens[this.current - elements.length - 1] || this.previous();
    const endToken = this.previous(); // Should be RBRACE
    const node = this.createNode(
      NodeType.Collection,
      { elements },
      startToken,
      endToken
    ) as CollectionNode;
    
    node.children = elements;
    for (let i = 0; i < elements.length; i++) {
      this.setParent(elements[i]!, node);
      if (i > 0 && elements[i] && elements[i - 1]) {
        elements[i]!.previousSibling = elements[i - 1]!;
        elements[i - 1]!.nextSibling = elements[i]!;
      }
    }
    
    return node;
  }
  
  protected handleError(message: string, token?: Token): LSPNode {
    this.addError(message, token);
    
    // Try to recover
    if (this.partialMode) {
      // In partial mode, create error node and continue
      return this.createErrorNode(message, token) as unknown as LSPNode;
    }
    
    // Synchronize to next valid token
    this.synchronize();
    
    return this.createErrorNode(message, token) as unknown as LSPNode;
  }
  
  // Override base parser methods to handle trivia
  protected override expression(): LSPNode {
    this.skipTrivia();
    return this.parseExpressionWithPrecedence(0);
  }
  
  protected override parseExpressionWithPrecedence(minPrecedence: number): LSPNode {
    let left = this.parsePrimary();

    while (this.current < this.tokens.length) {
      this.skipTrivia();
      const token = this.tokens[this.current];
      if (!token || token.type === TokenType.EOF) break;
      
      // Get operator value for precedence check
      let operator: string | undefined;
      let precedence = 0;
      
      if (token.type === TokenType.DOT) {
        operator = '.';
        precedence = registry.getPrecedence(operator);
      } else if (token.type === TokenType.OPERATOR) {
        operator = token.value;
        precedence = registry.getPrecedence(operator);
      } else if (token.type === TokenType.IDENTIFIER) {
        // Check if it's a keyword operator
        if (registry.isKeywordOperator(token.value)) {
          operator = token.value;
          precedence = registry.getPrecedence(operator);
        }
      }
      
      if (precedence < minPrecedence) break;

      if (token.type === TokenType.DOT) {
        this.current++;
        this.skipTrivia();
        const right = this.parseInvocation();
        left = this.createBinaryNode(token, left, right);
      } else if (token.type === TokenType.IDENTIFIER && token.value === 'is') {
        this.current++;
        this.skipTrivia();
        const typeName = this.parseTypeName();
        left = this.createMembershipTestNode(left, typeName, this.getPosition(token));
      } else if (token.type === TokenType.IDENTIFIER && token.value === 'as') {
        this.current++;
        this.skipTrivia();
        const typeName = this.parseTypeName();
        left = this.createTypeCastNode(left, typeName, this.getPosition(token));
      } else if (operator && registry.isBinaryOperator(operator)) {
        this.current++;
        this.skipTrivia();
        const associativity = registry.getAssociativity(operator);
        const nextMinPrecedence = associativity === 'left' ? precedence + 1 : precedence;
        const right = this.parseExpressionWithPrecedence(nextMinPrecedence);
        
        left = this.createBinaryNode(token, left, right);
      } else if (token.type === TokenType.LBRACKET) {
        this.current++;
        this.skipTrivia();
        const index = this.expression();
        this.consume(TokenType.RBRACKET, "Expected ']'");
        left = this.createIndexNode(left, index, this.getPosition(token));
      } else if (token.type === TokenType.LPAREN && this.isFunctionCall(left)) {
        this.current++;
        this.skipTrivia();
        const args = this.parseArgumentList();
        this.consume(TokenType.RPAREN, "Expected ')'");
        left = this.createFunctionNode(left, args, left.position);
      } else {
        break;
      }
    }

    return left;
  }
  
  protected override parsePrimary(): LSPNode {
    this.skipTrivia();
    return super.parsePrimary();
  }
  
  protected override parseInvocation(): LSPNode {
    this.skipTrivia();
    return super.parseInvocation();
  }
  
  protected override parseArgumentList(): LSPNode[] {
    this.skipTrivia();
    return super.parseArgumentList();
  }
  
  protected override peek(): Token {
    this.skipTrivia();
    return super.peek();
  }
  
  protected override advance(): Token {
    this.skipTrivia();
    const token = super.advance();
    this.skipTrivia();
    return token;
  }
  
  protected override check(type: TokenType): boolean {
    this.skipTrivia();
    return super.check(type);
  }
  
  protected override match(...types: TokenType[]): boolean {
    this.skipTrivia();
    return super.match(...types);
  }
  
  protected override consume(type: TokenType, message: string): Token {
    this.skipTrivia();
    return super.consume(type, message);
  }
  
  private skipTrivia(): void {
    while (this.current < this.tokens.length) {
      const token = this.tokens[this.current];
      if (token && (token.type === TokenType.WHITESPACE || 
                   token.type === TokenType.LINE_COMMENT || 
                   token.type === TokenType.BLOCK_COMMENT)) {
        this.current++;
      } else {
        break;
      }
    }
  }
  
  private collectTrivia(start: number, end: number): Trivia[] {
    const trivia: Trivia[] = [];
    
    for (let i = start; i < end && i < this.tokens.length; i++) {
      const token = this.tokens[i];
      if (token && (token.type === TokenType.WHITESPACE || 
                   token.type === TokenType.LINE_COMMENT || 
                   token.type === TokenType.BLOCK_COMMENT)) {
        trivia.push({
          type: token.type === TokenType.WHITESPACE ? 'whitespace' :
                token.type === TokenType.LINE_COMMENT ? 'lineComment' : 'comment',
          value: token.value,
          range: {
            start: { line: token.line, column: token.column, offset: token.start },
            end: { line: token.line, column: token.column + token.value.length, offset: token.end }
          }
        });
      }
    }
    
    return trivia;
  }
  
  // Helper methods
  private createNode(
    type: NodeType | 'Error',
    props: any,
    startToken: Token,
    endToken: Token
  ): LSPNode {
    const id = `node_${this.nodeIdCounter++}`;
    const range: Range = {
      start: this.getPosition(startToken),
      end: {
        line: endToken.line,
        column: endToken.column + (endToken.end - endToken.start),
        offset: endToken.end
      }
    };
    
    // Collect trivia
    const leadingTrivia = this.collectLeadingTrivia(startToken);
    const trailingTrivia = this.collectTrailingTrivia(endToken);
    
    // Calculate content range (excluding trivia)
    const contentRange: Range = {
      start: this.getPosition(startToken),
      end: {
        line: endToken.line,
        column: endToken.column + (endToken.end - endToken.start),
        offset: endToken.end
      }
    };
    
    const node = {
      id,
      type,
      range,
      contentRange,
      position: range.start,
      raw: this.input.substring(startToken.start, endToken.end),
      leadingTrivia,
      trailingTrivia,
      parent: this.currentParent,
      children: [],
      previousSibling: null,
      nextSibling: null,
      path: this.buildPath(id),
      depth: this.currentParent ? this.currentParent.depth + 1 : 0,
      ...props
    } as LSPASTNode;
    
    // Index the node
    this.nodeIndex.set(id, node);
    const nodesByType = this.nodesByType.get(type) || [];
    nodesByType.push(node);
    this.nodesByType.set(type, nodesByType);
    
    // Index identifiers
    if ((type === NodeType.Identifier || type === NodeType.TypeOrIdentifier) && props.name) {
      const identifiers = this.identifierIndex.get(props.name) || [];
      identifiers.push(node);
      this.identifierIndex.set(props.name, identifiers);
    }
    
    return node as LSPNode;
  }
  
  private createErrorNode(message: string, token?: Token): ErrorNode {
    const startToken = token || this.peek();
    const node = this.createNode(
      'Error',
      {
        message,
        actualToken: token,
        expectedTokens: this.getExpectedTokensForError()
      },
      startToken,
      startToken
    ) as unknown as ErrorNode;
    
    return node;
  }
  
  private setParent(child: LSPNode, parent: LSPNode): void {
    child.parent = parent;
    child.path = this.buildPath(child.id);
    child.depth = parent.depth + 1;
    
    // Recursively update depth for all descendants
    const updateDepth = (node: LSPNode, depth: number) => {
      node.depth = depth;
      node.children.forEach(c => updateDepth(c as LSPNode, depth + 1));
    };
    
    child.children.forEach(c => updateDepth(c as LSPNode, child.depth + 1));
  }
  
  private buildPath(nodeId: string): string {
    if (!this.currentParent) return nodeId;
    return `${this.currentParent.path}.${nodeId}`;
  }
  
  private findFirstToken(node: LSPNode): Token {
    // For now, use the node's start position to find the token
    // In a real implementation, we'd track this during parsing
    return this.tokens.find(t => t.start === node.range.start.offset) || this.previous();
  }
  
  private findLastToken(node: LSPNode): Token {
    // For now, use the node's end position to find the token
    return this.tokens.find(t => t.end === node.range.end.offset) || this.previous();
  }
  
  private collectLeadingTrivia(token: Token): Trivia[] {
    // For now, return empty trivia
    // In a real implementation, we'd track trivia during parsing
    return [];
  }
  
  private collectTrailingTrivia(token: Token): Trivia[] {
    // For now, return empty trivia
    // In a real implementation, we'd track trivia during parsing
    return [];
  }
  
  private addError(message: string, token?: Token): void {
    const position = token ? this.getPosition(token) : this.getCurrentPosition();
    const error: ParseError = {
      message,
      position,
      token
    };
    
    if (token) {
      error.range = {
        start: position,
        end: { line: token.line, column: token.column + (token.end - token.start), offset: token.end }
      };
    }
    
    this.errors.push(error);
  }
  
  private getCurrentPosition(): Position {
    const token = this.peek();
    return this.getPosition(token);
  }
  
  private synchronize(): void {
    // Skip tokens until we find a synchronization point
    while (!this.isAtEnd()) {
      if (this.synchronizationTokens.has(this.peek().type)) {
        return;
      }
      this.advance();
    }
  }
  
  private getExpectedTokensForError(): TokenType[] {
    // Context-aware expected tokens
    const expected: TokenType[] = [];
    
    // Always can end expression
    expected.push(TokenType.EOF);
    
    // Common continuations
    expected.push(
      TokenType.DOT,
      TokenType.LBRACKET,
      TokenType.LPAREN,
      TokenType.OPERATOR,  // All operators now use OPERATOR token
      TokenType.IDENTIFIER // Keyword operators
    );
    
    return expected;
  }
  
  private findNodeAtPosition(root: LSPASTNode, offset: number): LSPASTNode | null {
    // DFS to find the most specific node containing the position
    if (offset < root.range.start.offset || offset > root.range.end.offset) {
      return null;
    }
    
    for (const child of root.children) {
      const found = this.findNodeAtPosition(child, offset);
      if (found) return found;
    }
    
    return root;
  }
  
  private getExpectedTokens(node: LSPASTNode | null): TokenType[] {
    if (!node) return this.getExpectedTokensForError();
    
    // Context-specific expectations
    switch (node.type) {
      case NodeType.Binary:
        return [TokenType.DOT, TokenType.LBRACKET];
      case NodeType.Identifier:
        return [TokenType.DOT, TokenType.LPAREN, TokenType.LBRACKET];
      default:
        return this.getExpectedTokensForError();
    }
  }
  
  private getCompletions(node: LSPASTNode | null): string[] {
    if (!node) return [];
    
    // Basic completions based on context
    const completions: string[] = [];
    
    // Add all identifiers seen so far
    for (const name of this.identifierIndex.keys()) {
      completions.push(name);
    }
    
    // Add common FHIRPath functions
    completions.push(
      'where', 'select', 'first', 'last', 'tail',
      'skip', 'take', 'count', 'empty', 'exists'
    );
    
    return completions;
  }
  
  private createParseResult(ast: LSPASTNode): LSPParseResult {
    return {
      ast,
      errors: this.errors,
      indexes: {
        nodeById: this.nodeIndex,
        nodesByType: this.nodesByType,
        identifiers: this.identifierIndex
      }
    };
  }
}

export function parseLSP(input: string): LSPParseResult {
  const parser = new LSPParser(input);
  return parser.parse();
}

export function parsePartialLSP(input: string, cursorPosition: number): PartialParseResult {
  const parser = new LSPParser(input);
  return parser.parsePartial(cursorPosition);
}