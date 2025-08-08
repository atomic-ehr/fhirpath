import { Lexer, TokenType, Channel } from './lexer';
import type { Token, LexerOptions } from './lexer';
import { registry } from './registry';
import { NodeType } from './types';
import type { AnyCursorNode } from './cursor-nodes';
import {
  CursorContext,
  createCursorOperatorNode,
  createCursorIdentifierNode,
  createCursorArgumentNode,
  createCursorIndexNode,
  createCursorTypeNode,
} from './cursor-nodes';
import type {
  Position,
  Range,
  BaseASTNode,
  ASTNode,
  IdentifierNode,
  TypeOrIdentifierNode,
  LiteralNode,
  BinaryNode,
  UnaryNode,
  FunctionNode,
  VariableNode,
  IndexNode,
  MembershipTestNode,
  TypeCastNode,
  CollectionNode,
  TypeReferenceNode,
  QuantityNode,
  ErrorNode,
  TriviaInfo,
  ParseResult,
  ParseError
} from './types';
import { Errors, FHIRPathError, toDiagnostic } from './errors';

// Re-export types for backward compatibility
export {
  NodeType,
  type Position,
  type BaseASTNode,
  type Range,
  type ASTNode,
  type IdentifierNode,
  type TypeOrIdentifierNode,
  type LiteralNode,
  type BinaryNode,
  type UnaryNode,
  type FunctionNode,
  type VariableNode,
  type IndexNode,
  type MembershipTestNode,
  type TypeCastNode,
  type CollectionNode,
  type TypeReferenceNode,
  type QuantityNode,
  type ErrorNode,
  type TriviaInfo,
  type ParseResult,
  type ParseError
} from './types';

// Parser options
export interface ParserOptions {
  mode?: 'simple' | 'lsp';     // Default: 'simple'
  preserveTrivia?: boolean;     // Auto-enabled in LSP mode
  buildIndexes?: boolean;       // Auto-enabled in LSP mode
  errorRecovery?: boolean;      // Auto-enabled in LSP mode
  partialParse?: {              // For partial parsing
    cursorPosition: number;
  };
  cursorPosition?: number;      // Cursor position for LSP support
}

export class Parser {
  protected lexer: Lexer;
  protected tokens: Token[] = [];
  protected current = 0;
  private mode: 'simple' | 'lsp';
  private options: ParserOptions;
  private errors?: ParseError[];
  private nodeIdCounter?: number;
  private nodeIndex?: Map<string, ASTNode>;
  private nodesByType?: Map<NodeType | 'Error', ASTNode[]>;
  private identifierIndex?: Map<string, ASTNode[]>;
  private currentParent?: ASTNode | null;
  private input: string;
  
  // Synchronization tokens for error recovery
  private readonly synchronizationTokens = new Set([
    TokenType.COMMA,
    TokenType.RPAREN,
    TokenType.RBRACE,
    TokenType.RBRACKET,
    TokenType.EOF
  ]);
  
  constructor(input: string, options: ParserOptions = {}) {
    const mode = options.mode || 'simple';
    const lexerOptions: LexerOptions = {
      trackPosition: true,
      preserveTrivia: mode === 'lsp' ? true : (options.preserveTrivia ?? false)
    };
    
    this.lexer = new Lexer(input, lexerOptions);
    this.tokens = this.lexer.tokenize();
    
    // Filter out trivia tokens if they exist (tokens on hidden channel)
    if (lexerOptions.preserveTrivia) {
      this.tokens = this.tokens.filter(token => 
        token.channel === undefined || token.channel === Channel.DEFAULT
      );
    }
    
    // Inject cursor token if cursor position is provided
    if (options.cursorPosition !== undefined) {
      this.tokens = this.injectCursorToken(this.tokens, options.cursorPosition);
    }
    
    this.input = input;
    this.mode = mode;
    this.options = options;
    
    // Initialize LSP features only if needed
    if (this.mode === 'lsp') {
      this.errors = [];
      this.nodeIdCounter = 0;
      this.nodeIndex = new Map();
      this.nodesByType = new Map();
      this.identifierIndex = new Map();
      this.currentParent = null;
    }
  }
  
  private checkCursor(): AnyCursorNode | null {
    if (this.peek().type === TokenType.CURSOR) {
      return null; // Will be handled contextually
    }
    return null;
  }
  
  private injectCursorToken(tokens: Token[], cursorPosition: number): Token[] {
    // Find the position to inject the cursor token
    let insertIndex = 0;
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token) continue;
      
      // Skip EOF token
      if (token.type === TokenType.EOF) {
        break;
      }
      
      // Check if cursor is before this token
      if (cursorPosition <= token.start) {
        insertIndex = i;
        break;
      }
      
      // Check if cursor is within this token (we ignore mid-token cursors)
      if (cursorPosition > token.start && cursorPosition < token.end) {
        // Cursor is mid-token, ignore it
        return tokens;
      }
      
      // Cursor is after this token
      insertIndex = i + 1;
    }
    
    // Create cursor token
    const cursorToken: Token = {
      type: TokenType.CURSOR,
      value: '',
      start: cursorPosition,
      end: cursorPosition,
      line: 1,
      column: cursorPosition + 1,
      range: {
        start: { line: 0, character: cursorPosition, offset: cursorPosition },
        end: { line: 0, character: cursorPosition, offset: cursorPosition }
      }
    };
    
    // Insert cursor token
    const result = [...tokens];
    result.splice(insertIndex, 0, cursorToken);
    
    return result;
  }
  
  private getRangeFromToken(token: Token): Range {
    return token.range || {
      start: { line: 0, character: 0, offset: token.start },
      end: { line: 0, character: 0, offset: token.end }
    };
  }
  
  private getRangeFromTokens(startToken: Token, endToken: Token): Range {
    const start = startToken.range?.start || { line: 0, character: 0, offset: startToken.start };
    const end = endToken.range?.end || { line: 0, character: 0, offset: endToken.end };
    return { start, end };
  }
  
  private getRangeFromNodes(startNode: ASTNode, endNode: ASTNode): Range {
    return {
      start: startNode.range.start,
      end: endNode.range.end
    };
  }

  parse(): ParseResult {
    if (this.mode === 'simple') {
      return this.parseSimple();
    } else {
      return this.parseLSP();
    }
  }
  
  private parseSimple(): ParseResult {
    const errors: ParseError[] = [];
    let ast: ASTNode;
    
    try {
      ast = this.expression();
      if (!this.isAtEnd()) {
        const token = this.peek();
        throw Errors.unexpectedToken(token.value || TokenType[token.type], this.getRangeFromToken(token));
      }
    } catch (error) {
      // In simple mode, we still collect the error but also throw
      if (error instanceof Error) {
        const token = this.peek();
        errors.push({
          message: error.message,
          position: {
            line: token.line || 0,
            character: token.column || 0,
            offset: token.start
          },
          range: this.getRangeFromToken(token),
          token
        });
        throw error; // Re-throw for backward compatibility
      }
      throw error;
    }
    
    return {
      ast,
      errors
    };
  }
  
  private parseLSP(): ParseResult {
    // Clear indexes for fresh parse
    this.errors = [];
    this.nodeIndex!.clear();
    this.nodesByType!.clear();
    this.identifierIndex!.clear();
    
    let ast: ASTNode;
    
    try {
      ast = this.expression();
      
      if (!this.isAtEnd()) {
        const token = this.peek();
        this.addError(Errors.unexpectedToken(token.value || TokenType[token.type], this.getRangeFromToken(token)).message, token);
      }
    } catch (error) {
      // In LSP mode, create error node on fatal errors
      if (error instanceof Error) {
        ast = this.createErrorNode(error.message, this.peek());
      } else {
        ast = this.createErrorNode('Parse failed', this.peek());
      }
    }
    
    const result: ParseResult = {
      ast,
      errors: this.errors!,
      indexes: {
        nodeById: this.nodeIndex!,
        nodesByType: this.nodesByType!,
        identifiers: this.identifierIndex!
      }
    };
    
    // Add cursor context if partial parsing
    if (this.options.partialParse) {
      const nodeAtCursor = this.findNodeAtPosition(ast, this.options.partialParse.cursorPosition);
      result.cursorContext = {
        node: nodeAtCursor,
        expectedTokens: this.getExpectedTokens(nodeAtCursor),
        availableCompletions: this.getCompletions(nodeAtCursor)
      };
    }
    
    return result;
  }
  
  // Shared expression parsing with precedence climbing
  protected expression(): ASTNode {
    return this.parseExpressionWithPrecedence(0);
  }
  
  protected parseExpressionWithPrecedence(minPrecedence: number): ASTNode {
    let left = this.parsePrimary();

    // Inline isAtEnd() and peek() for hot path
    while (this.current < this.tokens.length) {
      const token = this.tokens[this.current];
      if (!token || token.type === TokenType.EOF) break;
      
      // Check for cursor between expressions (expecting operator)
      if (token.type === TokenType.CURSOR) {
        this.advance();
        // Create a partial binary node to preserve left context
        const cursorNode = createCursorOperatorNode(token.start) as any;
        return this.createBinaryNode(token, left, cursorNode);
      }
      
      // Check for postfix operations that don't have precedence requirements
      if (token.type === TokenType.LBRACKET) {
        // Array indexing - always binds tightly
        this.current++; // inline advance()
        // Check for cursor in indexer
        if (this.peek().type === TokenType.CURSOR) {
          this.advance();
          left = createCursorIndexNode(this.previous().start) as any;
        } else {
          const index = this.expression();
          this.consume(TokenType.RBRACKET, "Expected ']'");
          left = this.createIndexNode(left, index, token);
        }
        continue;
      }
      
      if (token.type === TokenType.LPAREN && this.isFunctionCall(left)) {
        // Function calls - always bind tightly
        this.current++; // inline advance()
        const args = this.parseArgumentList();
        this.consume(TokenType.RPAREN, "Expected ')'");
        // For function calls, we need to find the start token from the name node
        const startToken = this.tokens[this.current - args.length - 2] || token;
        left = this.createFunctionNode(left, args, startToken);
        continue;
      }
      
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
        this.current++; // inline advance()
        const right = this.parseInvocation();
        left = this.createBinaryNode(token, left, right);
      } else if (token.type === TokenType.IDENTIFIER && token.value === 'is') {
        this.current++; // inline advance()
        // Check for cursor after 'is'
        if (this.peek().type === TokenType.CURSOR) {
          this.advance();
          left = createCursorTypeNode(this.previous().start, 'is') as any;
        } else {
          const typeName = this.parseTypeName();
          left = this.createMembershipTestNode(left, typeName, token);
        }
      } else if (token.type === TokenType.IDENTIFIER && token.value === 'as') {
        this.current++; // inline advance()
        // Check for cursor after 'as'
        if (this.peek().type === TokenType.CURSOR) {
          this.advance();
          left = createCursorTypeNode(this.previous().start, 'as') as any;
        } else {
          const typeName = this.parseTypeName();
          left = this.createTypeCastNode(left, typeName, token);
        }
      } else if (operator && registry.isBinaryOperator(operator)) {
        this.current++; // inline advance()
        const associativity = registry.getAssociativity(operator);
        const nextMinPrecedence = associativity === 'left' ? precedence + 1 : precedence;
        const right = this.parseExpressionWithPrecedence(nextMinPrecedence);
        
        left = this.createBinaryNode(token, left, right);
      } else {
        break;
      }
    }

    return left;
  }
  
  protected parsePrimary(): ASTNode {
    // Inline peek() for hot path
    const token = this.current < this.tokens.length ? this.tokens[this.current]! : { type: TokenType.EOF, value: '', start: 0, end: 0, line: 1, column: 1 };

    // Handle cursor at expression start
    if (token.type === TokenType.CURSOR) {
      this.advance();
      return createCursorOperatorNode(token.start) as any;
    }

    if (token.type === TokenType.NUMBER) {
      this.current++; // inline advance()
      const numberValue = parseFloat(token.value);
      
      // Check if next token is a string (quantity unit)
      const nextToken = this.peek();
      if (nextToken.type === TokenType.STRING) {
        this.advance();
        const unit = this.parseStringValue(nextToken.value);
        return this.createQuantityNode(numberValue, unit, false, token, nextToken);
      }
      
      // Check if next token is a calendar duration identifier
      if (nextToken.type === TokenType.IDENTIFIER) {
        const calendarUnits = ['year', 'years', 'month', 'months', 'week', 'weeks', 
                              'day', 'days', 'hour', 'hours', 'minute', 'minutes', 
                              'second', 'seconds', 'millisecond', 'milliseconds'];
        if (calendarUnits.includes(nextToken.value)) {
          this.advance();
          return this.createQuantityNode(numberValue, nextToken.value, true, token, nextToken);
        }
      }
      
      return this.createLiteralNode(numberValue, 'number', token);
    }

    if (token.type === TokenType.STRING) {
      this.current++; // inline advance()
      const value = this.parseStringValue(token.value);
      return this.createLiteralNode(value, 'string', token);
    }

    if (token.type === TokenType.IDENTIFIER && (token.value === 'true' || token.value === 'false')) {
      this.advance();
      return this.createLiteralNode(token.value === 'true', 'boolean', token);
    }

    if (token.type === TokenType.IDENTIFIER && token.value === 'null') {
      this.advance();
      return this.createLiteralNode(null, 'null', token);
    }

    if (token.type === TokenType.DATETIME) {
      this.advance();
      const value = token.value.substring(1); // Remove @
      return this.createLiteralNode(value, 'datetime', token);
    }

    if (token.type === TokenType.TIME) {
      this.advance();
      const value = token.value.substring(1); // Remove @
      return this.createLiteralNode(value, 'time', token);
    }

    if (token.type === TokenType.SPECIAL_IDENTIFIER) {
      this.advance();
      return this.createVariableNode(token.value, token);
    }

    if (token.type === TokenType.ENVIRONMENT_VARIABLE) {
      this.advance();
      return this.createVariableNode(token.value, token);
    }

    if (token.type === TokenType.IDENTIFIER && token.value === 'not') {
      this.advance();
      const operand = this.parseExpressionWithPrecedence(registry.getPrecedence('not'));
      return this.createUnaryNode(token, operand);
    }

    if (token.type === TokenType.IDENTIFIER) {
      this.advance();
      const name = this.parseIdentifierValue(token.value);
      return this.createIdentifierNode(name, token);
    }

    if (token.type === TokenType.LPAREN) {
      this.advance();
      const expr = this.expression();
      this.consume(TokenType.RPAREN, "Expected ')'");
      return expr;
    }

    if (token.type === TokenType.LBRACE) {
      this.advance();
      const elements = this.parseCollectionElements();
      this.consume(TokenType.RBRACE, "Expected '}'");
      return this.createCollectionNode(elements, token);
    }

    // Handle unary operators
    if (token.type === TokenType.OPERATOR && (token.value === '+' || token.value === '-')) {
      this.advance();
      const operand = this.parseExpressionWithPrecedence(registry.getPrecedence('*'));
      return this.createUnaryNode(token, operand);
    }

    const tokenStr = token.value || TokenType[token.type];
    const range = this.getRangeFromToken(token);
    const error = Errors.unexpectedToken(tokenStr, range);
    return this.handleError(error.message, token);
  }
  
  protected parseInvocation(): ASTNode {
    const token = this.peek();
    
    // Handle cursor after dot
    if (token.type === TokenType.CURSOR) {
      this.advance();
      return createCursorIdentifierNode(token.start) as any;
    }
    
    // Allow identifiers and keywords that can be used as member names
    if (token.type === TokenType.IDENTIFIER) {
      this.advance();
      const name = this.parseIdentifierValue(token.value);
      const node = this.createIdentifierNode(name, token);
      
      // Check if this is a function call
      if (this.check(TokenType.LPAREN)) {
        this.advance();
        const args = this.parseArgumentList();
        this.consume(TokenType.RPAREN, "Expected ')'");
        const startToken = this.tokens[this.current - args.length - 2] || this.previous();
        return this.createFunctionNode(node, args, startToken);
      }
      
      return node;
    }
    
    // Allow environment variables after dot (like .%resource)
    if (token.type === TokenType.ENVIRONMENT_VARIABLE) {
      this.advance();
      return this.createVariableNode(token.value, token);
    }

    const tokenStr = token.value || TokenType[token.type];
    const range = this.getRangeFromToken(token);
    const error = Errors.expectedIdentifier('.', tokenStr, range);
    return this.handleError(error.message, token);
  }
  
  protected parseArgumentList(): ASTNode[] {
    const args: ASTNode[] = [];
    
    // Check for cursor at start of arguments
    if (this.peek().type === TokenType.CURSOR) {
      this.advance();
      // Need to get function name from context - for now use empty string
      args.push(createCursorArgumentNode(this.previous().start, '', 0) as any);
      return args;
    }
    
    if (this.peek().type === TokenType.RPAREN) {
      return args;
    }

    args.push(this.expression());
    
    while (this.match(TokenType.COMMA)) {
      // Check for cursor after comma
      if (this.peek().type === TokenType.CURSOR) {
        this.advance();
        args.push(createCursorArgumentNode(this.previous().start, '', args.length) as any);
        return args;
      }
      args.push(this.expression());
    }

    return args;
  }
  
  protected parseCollectionElements(): ASTNode[] {
    const elements: ASTNode[] = [];
    
    if (this.peek().type === TokenType.RBRACE) {
      return elements;
    }

    elements.push(this.expression());
    
    while (this.match(TokenType.COMMA)) {
      elements.push(this.expression());
    }

    return elements;
  }
  
  protected parseTypeName(): string {
    const token = this.advance();
    if (token.type !== TokenType.IDENTIFIER) {
      const tokenStr = token.value || TokenType[token.type];
      const range = this.getRangeFromToken(token);
      const error = Errors.expectedTypeName(tokenStr, range);
      this.handleError(error.message, token);
      return ''; // For TypeScript, though handleError should throw/return error node
    }
    return this.parseIdentifierValue(token.value);
  }
  
  protected parseStringValue(raw: string): string {
    // Remove quotes and handle escape sequences
    const content = raw.slice(1, -1);
    return content.replace(/\\(.)/g, (_, char) => {
      switch (char) {
        case 'n': return '\n';
        case 'r': return '\r';
        case 't': return '\t';
        case 'f': return '\f';
        case '\\': return '\\';
        case "'": return "'";
        case '"': return '"';
        case '`': return '`';
        case '/': return '/';
        default: return char;
      }
    });
  }
  
  protected parseIdentifierValue(raw: string): string {
    if (raw.startsWith('`')) {
      // Delimited identifier - remove backticks and handle escapes
      return raw.slice(1, -1).replace(/\\(.)/g, '$1');
    }
    return raw;
  }
  
  // Shared utility methods
  protected isFunctionCall(node: ASTNode): boolean {
    return (node as any).type === NodeType.Identifier || (node as any).type === NodeType.TypeOrIdentifier;
  }
  
  // Helper method to check if a token is a binary operator
  protected isBinaryOperatorToken(token: Token): boolean {
    if (token.type === TokenType.OPERATOR || token.type === TokenType.DOT) {
      return registry.isBinaryOperator(token.value);
    }
    if (token.type === TokenType.IDENTIFIER) {
      return registry.isKeywordOperator(token.value);
    }
    return false;
  }
  
  protected isKeywordAllowedAsMember(token: Token): boolean {
    // Keywords that can be used as member names
    if (token.type !== TokenType.IDENTIFIER) return false;
    
    const keywordsAllowed = [
      'contains', 'and', 'or', 'xor', 'implies', 
      'as', 'is', 'div', 'mod', 'in', 'true', 'false'
    ];
    
    return keywordsAllowed.includes(token.value.toLowerCase());
  }
  
  protected isKeywordAllowedAsIdentifier(token: Token): boolean {
    // Keywords that can be used as identifiers in certain contexts
    return this.isKeywordAllowedAsMember(token);
  }
  
  // Helper methods
  protected peek(): Token {
    return this.tokens[this.current] || { type: TokenType.EOF, value: '', start: 0, end: 0, line: 1, column: 1 };
  }
  
  protected previous(): Token {
    return this.tokens[this.current - 1] || { type: TokenType.EOF, value: '', start: 0, end: 0, line: 1, column: 1 };
  }
  
  protected isAtEnd(): boolean {
    return this.current >= this.tokens.length || this.peek().type === TokenType.EOF;
  }
  
  protected advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }
  
  protected check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }
  
  protected match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }
  
  protected consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    
    // Be lenient when cursor is present and we're at EOF
    if (this.options.cursorPosition !== undefined && this.isAtEnd()) {
      // Return a synthetic token to allow parsing to continue
      return {
        type,
        value: '',
        start: this.input.length,
        end: this.input.length
      } as Token;
    }
    
    const token = this.peek();
    const tokenStr = token.value || TokenType[token.type];
    const range = this.getRangeFromToken(token);
    const error = Errors.expectedToken(TokenType[type], tokenStr, range);
    return this.handleError(error.message, token) as any;
  }

  // Implement node creation methods
  protected createIdentifierNode(name: string, token: Token): ASTNode {
    const range = this.getRangeFromToken(token);
    const isType = name[0] && name[0] >= 'A' && name[0] <= 'Z';
    const nodeType = isType ? NodeType.TypeOrIdentifier : NodeType.Identifier;
    
    const node: ASTNode = {
      type: nodeType,
      name,
      range
    };
    
    // Add LSP features if in LSP mode
    if (this.mode === 'lsp') {
      this.enrichNodeForLSP(node, token);
      
      // Index identifier
      const identifiers = this.identifierIndex!.get(name) || [];
      identifiers.push(node);
      this.identifierIndex!.set(name, identifiers);
    }
    
    return node;
  }

  protected createLiteralNode(value: any, valueType: LiteralNode['valueType'], token: Token): LiteralNode {
    const node: LiteralNode = {
      type: NodeType.Literal,
      value,
      valueType,
      range: this.getRangeFromToken(token)
    };
    
    if (this.mode === 'lsp') {
      this.enrichNodeForLSP(node, token);
    }
    
    return node;
  }

  protected createBinaryNode(token: Token, left: ASTNode, right: ASTNode): BinaryNode {
    const node: BinaryNode = {
      type: NodeType.Binary,
      operator: token.value,
      left,
      right,
      range: this.getRangeFromNodes(left, right)
    };
    
    if (this.mode === 'lsp') {
      // For binary nodes, we need to find the actual start and end tokens
      const startToken = this.tokens.find(t => t.start === left.range.start.offset) || token;
      const endToken = this.tokens.find(t => t.end === right.range.end.offset) || token;
      this.enrichNodeForLSP(node, startToken, endToken);
      
      // Set up parent-child relationships
      if (node.id) {
        left.parent = node;
        right.parent = node;
        node.children = [left, right];
      }
    }
    
    return node;
  }

  protected createUnaryNode(token: Token, operand: ASTNode): UnaryNode {
    const startPos = token.range?.start || { line: 0, character: 0, offset: token.start };
    const node: UnaryNode = {
      type: NodeType.Unary,
      operator: token.value,
      operand,
      range: { start: startPos, end: operand.range.end }
    };
    
    if (this.mode === 'lsp') {
      const endToken = this.tokens.find(t => t.end === operand.range.end.offset) || token;
      this.enrichNodeForLSP(node, token, endToken);
      
      if (node.id) {
        operand.parent = node;
        node.children = [operand];
      }
    }
    
    return node;
  }

  protected createFunctionNode(name: ASTNode, args: ASTNode[], startToken: Token): FunctionNode {
    const endNode = args.length > 0 ? args[args.length - 1]! : name;
    const node: FunctionNode = {
      type: NodeType.Function,
      name,
      arguments: args,
      range: this.getRangeFromNodes(name, endNode)
    };
    
    if (this.mode === 'lsp') {
      const startTok = this.tokens.find(t => t.start === name.range.start.offset) || startToken;
      const endToken = this.tokens.find(t => t.end === endNode.range.end.offset) || startToken;
      this.enrichNodeForLSP(node, startTok, endToken);
      
      if (node.id) {
        name.parent = node;
        args.forEach(arg => { arg.parent = node; });
        node.children = [name, ...args];
      }
    }
    
    return node;
  }

  protected createVariableNode(name: string, token: Token): VariableNode {
    const node: VariableNode = {
      type: NodeType.Variable,
      name,
      range: this.getRangeFromToken(token)
    };
    
    if (this.mode === 'lsp') {
      this.enrichNodeForLSP(node, token);
    }
    
    return node;
  }

  protected createIndexNode(expression: ASTNode, index: ASTNode, startToken: Token): IndexNode {
    const node: IndexNode = {
      type: NodeType.Index,
      expression,
      index,
      range: this.getRangeFromNodes(expression, index)
    };
    
    if (this.mode === 'lsp') {
      const startTok = this.tokens.find(t => t.start === expression.range.start.offset) || startToken;
      const endToken = this.tokens.find(t => t.end === index.range.end.offset) || startToken;
      this.enrichNodeForLSP(node, startTok, endToken);
      
      if (node.id) {
        expression.parent = node;
        index.parent = node;
        node.children = [expression, index];
      }
    }
    
    return node;
  }


  protected createMembershipTestNode(expression: ASTNode, targetType: string, startToken: Token): MembershipTestNode {
    // The range should extend from expression to the end of the type name
    const endToken = this.previous(); // Should be the type identifier
    const node: MembershipTestNode = {
      type: NodeType.MembershipTest,
      expression,
      targetType,
      range: this.getRangeFromTokens(startToken, endToken)
    };
    
    if (this.mode === 'lsp') {
      const startTok = this.tokens.find(t => t.start === expression.range.start.offset) || startToken;
      this.enrichNodeForLSP(node, startTok, endToken);
      
      if (node.id) {
        expression.parent = node;
        node.children = [expression];
      }
    }
    
    return node;
  }

  protected createTypeCastNode(expression: ASTNode, targetType: string, startToken: Token): TypeCastNode {
    // The range should extend from expression to the end of the type name
    const endToken = this.previous(); // Should be the type identifier
    const node: TypeCastNode = {
      type: NodeType.TypeCast,
      expression,
      targetType,
      range: this.getRangeFromTokens(startToken, endToken)
    };
    
    if (this.mode === 'lsp') {
      const startTok = this.tokens.find(t => t.start === expression.range.start.offset) || startToken;
      this.enrichNodeForLSP(node, startTok, endToken);
      
      if (node.id) {
        expression.parent = node;
        node.children = [expression];
      }
    }
    
    return node;
  }

  protected createCollectionNode(elements: ASTNode[], startToken: Token): CollectionNode {
    const endToken = this.previous(); // Should be RBRACE
    const node: CollectionNode = {
      type: NodeType.Collection,
      elements,
      range: this.getRangeFromTokens(startToken, endToken)
    };
    
    if (this.mode === 'lsp') {
      this.enrichNodeForLSP(node, startToken, endToken);
      
      if (node.id) {
        elements.forEach(elem => { elem.parent = node; });
        node.children = elements;
      }
    }
    
    return node;
  }

  protected createQuantityNode(value: number, unit: string, isCalendarUnit: boolean, startToken: Token, endToken: Token): QuantityNode {
    const node: QuantityNode = {
      type: NodeType.Quantity,
      value,
      unit,
      isCalendarUnit,
      range: this.getRangeFromTokens(startToken, endToken)
    };
    
    if (this.mode === 'lsp') {
      this.enrichNodeForLSP(node, startToken, endToken);
    }
    
    return node;
  }

  protected handleError(message: string, token?: Token): never {
    if (this.mode === 'lsp' && this.options.errorRecovery) {
      // In LSP mode with error recovery, add error and try to recover
      this.addError(message, token);
      
      // Try to synchronize
      this.synchronize();
      
      // Return error node (cast to never to satisfy type system)
      return this.createErrorNode(message, token) as never;
    }
    
    // In simple mode, throw error
    const range = token ? this.getRangeFromToken(token) : undefined;
    throw Errors.invalidSyntax(message, range);
  }
  
  // LSP mode helper methods
  private enrichNodeForLSP(node: ASTNode, startToken: Token, endToken?: Token): void {
    if (this.mode !== 'lsp') return;
    
    // Add unique ID
    node.id = `node_${this.nodeIdCounter!++}`;
    
    // Add raw source text
    const start = startToken.start;
    const end = endToken ? endToken.end : startToken.end;
    node.raw = this.input.substring(start, end);
    
    // Add trivia if preserving
    if (this.options.preserveTrivia) {
      node.leadingTrivia = [];  // TODO: Implement trivia collection
      node.trailingTrivia = [];
    }
    
    // Set parent relationship
    if (this.currentParent) {
      node.parent = this.currentParent;
    }
    
    // Index node
    this.nodeIndex!.set(node.id, node);
    const nodesByType = this.nodesByType!.get(node.type) || [];
    nodesByType.push(node);
    this.nodesByType!.set(node.type, nodesByType);
  }
  
  private createErrorNode(message: string, token?: Token): ErrorNode {
    const range = token ? this.getRangeFromToken(token) : {
      start: { line: 0, character: 0, offset: 0 },
      end: { line: 0, character: 0, offset: 0 }
    };
    
    const node: ErrorNode = {
      type: 'Error',
      message,
      range
    };
    
    if (this.mode === 'lsp') {
      this.enrichNodeForLSP(node, token || this.peek());
    }
    
    return node;
  }
  
  private addError(message: string, token?: Token): void {
    if (!this.errors) return;
    
    const position = token ? {
      line: token.line || 0,
      character: token.column || 0,
      offset: token.start
    } : { line: 0, character: 0, offset: 0 };
    
    const error: ParseError = {
      message,
      position,
      token
    };
    
    if (token) {
      error.range = this.getRangeFromToken(token);
    }
    
    this.errors.push(error);
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
  
  private findNodeAtPosition(root: ASTNode, offset: number): ASTNode | null {
    // DFS to find the most specific node containing the position
    if (offset < root.range.start.offset! || offset > root.range.end.offset!) {
      return null;
    }
    
    // Check children if they exist
    if ('children' in root && Array.isArray(root.children)) {
      for (const child of root.children) {
        const found = this.findNodeAtPosition(child, offset);
        if (found) return found;
      }
    }
    
    // Check specific node types
    if (root.type === NodeType.Binary) {
      const binaryNode = root as BinaryNode;
      const leftResult = this.findNodeAtPosition(binaryNode.left, offset);
      if (leftResult) return leftResult;
      const rightResult = this.findNodeAtPosition(binaryNode.right, offset);
      if (rightResult) return rightResult;
    } else if (root.type === NodeType.Unary) {
      const unaryNode = root as UnaryNode;
      return this.findNodeAtPosition(unaryNode.operand, offset);
    } else if (root.type === NodeType.Function) {
      const funcNode = root as FunctionNode;
      const nameResult = this.findNodeAtPosition(funcNode.name, offset);
      if (nameResult) return nameResult;
      for (const arg of funcNode.arguments) {
        const argResult = this.findNodeAtPosition(arg, offset);
        if (argResult) return argResult;
      }
    }
    
    return root;
  }
  
  private getExpectedTokens(node: ASTNode | null): TokenType[] {
    if (!node) return this.getExpectedTokensForError();
    
    // Context-specific expectations
    switch (node.type) {
      case NodeType.Binary:
        return [TokenType.DOT, TokenType.LBRACKET];
      case NodeType.Identifier:
      case NodeType.TypeOrIdentifier:
        return [TokenType.DOT, TokenType.LPAREN, TokenType.LBRACKET];
      default:
        return this.getExpectedTokensForError();
    }
  }
  
  private getExpectedTokensForError(): TokenType[] {
    // Common continuations
    return [
      TokenType.EOF,
      TokenType.DOT,
      TokenType.LBRACKET,
      TokenType.LPAREN,
      TokenType.OPERATOR,
      TokenType.IDENTIFIER
    ];
  }
  
  private getCompletions(node: ASTNode | null): string[] {
    if (!node) return [];
    
    const completions: string[] = [];
    
    // Add all identifiers seen so far
    if (this.identifierIndex) {
      for (const name of Array.from(this.identifierIndex.keys())) {
        completions.push(name);
      }
    }
    
    // Add common FHIRPath functions
    completions.push(
      'where', 'select', 'first', 'last', 'tail',
      'skip', 'take', 'count', 'empty', 'exists'
    );
    
    return completions;
  }
}

export function parse(input: string, options?: ParserOptions): ParseResult {
  const parser = new Parser(input, options);
  return parser.parse();
}

/**
 * Pretty print AST in Lisp style
 * @param node - The AST node to print
 * @param indent - Current indentation level
 * @returns Lisp-style string representation
 */
export function pprint(node: ASTNode, indent: number = 0): string {
  const spaces = ' '.repeat(indent);
  
  switch (node.type) {
    case NodeType.Literal: {
      const lit = node as LiteralNode;
      if (lit.valueType === 'string') {
        return `"${lit.value}"`;
      } else if (lit.valueType === 'null') {
        return 'null';
      }
      return String(lit.value);
    }
    
    case NodeType.Identifier:
    case NodeType.TypeOrIdentifier: {
      const id = node as IdentifierNode | TypeOrIdentifierNode;
      return id.name;
    }
    
    case NodeType.Variable: {
      const v = node as VariableNode;
      return v.name;
    }
    
    case NodeType.Binary: {
      const bin = node as BinaryNode;
      const op = bin.operator;
      
      // For simple expressions, put on one line
      const leftStr = pprint(bin.left, 0);
      const rightStr = pprint(bin.right, 0);
      
      if (leftStr.length + rightStr.length + op.length + 4 < 60 && 
          !leftStr.includes('\n') && !rightStr.includes('\n')) {
        return `(${op} ${leftStr} ${rightStr})`;
      }
      
      // For complex expressions, use multiple lines
      return `(${op}\n${spaces}  ${pprint(bin.left, indent + 2)}\n${spaces}  ${pprint(bin.right, indent + 2)})`;
    }
    
    case NodeType.Unary: {
      const un = node as UnaryNode;
      const operandStr = pprint(un.operand, 0);
      
      if (operandStr.length < 40 && !operandStr.includes('\n')) {
        return `(${un.operator} ${operandStr})`;
      }
      
      return `(${un.operator}\n${spaces}  ${pprint(un.operand, indent + 2)})`;
    }
    
    case NodeType.Function: {
      const fn = node as FunctionNode;
      const nameStr = pprint(fn.name, 0);
      
      if (fn.arguments.length === 0) {
        return `(${nameStr})`;
      }
      
      const argStrs = fn.arguments.map(arg => pprint(arg, 0));
      const totalLen = nameStr.length + argStrs.reduce((sum, s) => sum + s.length + 1, 0) + 2;
      
      if (totalLen < 60 && argStrs.every(s => !s.includes('\n'))) {
        return `(${nameStr} ${argStrs.join(' ')})`;
      }
      
      // Multi-line format
      const argLines = fn.arguments.map(arg => `${spaces}  ${pprint(arg, indent + 2)}`);
      return `(${nameStr}\n${argLines.join('\n')})`;
    }
    
    case NodeType.Index: {
      const idx = node as IndexNode;
      const exprStr = pprint(idx.expression, 0);
      const indexStr = pprint(idx.index, 0);
      
      if (exprStr.length + indexStr.length < 50 && 
          !exprStr.includes('\n') && !indexStr.includes('\n')) {
        return `([] ${exprStr} ${indexStr})`;
      }
      
      return `([]\n${spaces}  ${pprint(idx.expression, indent + 2)}\n${spaces}  ${pprint(idx.index, indent + 2)})`;
    }
    
    case NodeType.MembershipTest: {
      const mt = node as MembershipTestNode;
      const exprStr = pprint(mt.expression, 0);
      
      if (exprStr.length + mt.targetType.length < 50 && !exprStr.includes('\n')) {
        return `(is ${exprStr} ${mt.targetType})`;
      }
      
      return `(is\n${spaces}  ${pprint(mt.expression, indent + 2)}\n${spaces}  ${mt.targetType})`;
    }
    
    case NodeType.TypeCast: {
      const tc = node as TypeCastNode;
      const exprStr = pprint(tc.expression, 0);
      
      if (exprStr.length + tc.targetType.length < 50 && !exprStr.includes('\n')) {
        return `(as ${exprStr} ${tc.targetType})`;
      }
      
      return `(as\n${spaces}  ${pprint(tc.expression, indent + 2)}\n${spaces}  ${tc.targetType})`;
    }
    
    case NodeType.Collection: {
      const coll = node as CollectionNode;
      
      if (coll.elements.length === 0) {
        return '{}';
      }
      
      const elemStrs = coll.elements.map(e => pprint(e, 0));
      const totalLen = elemStrs.reduce((sum, s) => sum + s.length + 1, 2);
      
      if (totalLen < 60 && elemStrs.every(s => !s.includes('\n'))) {
        return `{${elemStrs.join(' ')}}`;
      }
      
      const elemLines = coll.elements.map(e => `${spaces}  ${pprint(e, indent + 2)}`);
      return `{\n${elemLines.join('\n')}\n${spaces}}`;
    }
    
    case NodeType.TypeReference: {
      const tr = node as TypeReferenceNode;
      return `Type[${tr.typeName}]`;
    }
    
    case NodeType.Quantity: {
      const q = node as QuantityNode;
      if (q.isCalendarUnit) {
        return `${q.value} ${q.unit}`;
      }
      return `${q.value} '${q.unit}'`;
    }
    
    default:
      return `<unknown:${node.type}>`;
  }
}