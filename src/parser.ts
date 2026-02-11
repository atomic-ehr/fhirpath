import { Lexer, TokenType, Channel } from './lexer';
import type { Token, LexerOptions } from './lexer';
import { registry } from './registry';
import { NodeType } from './types';
import {
  createCursorOperatorNode,
  createCursorIdentifierNode,
  createCursorArgumentNode,
  createCursorIndexNode,
  createCursorTypeNode,
} from './parser/cursor-nodes';
import type {
  Position,
  Range,
  BaseASTNode,
  ASTNode,
  IdentifierNode,
  LiteralNode,
  TemporalLiteralNode,
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
import { Errors } from './errors';
import { parseTemporalLiteral } from './complex-types/temporal';
import { augment } from './analyzer/augmentor';
import { findNodeAtPosition, getCompletions as lspGetCompletions, getExpectedTokens as lspGetExpectedTokens } from './analyzer/cursor-services';
import { computeTriviaSpans } from './analyzer/trivia-indexer';

// Re-export types for backward compatibility
export {
  NodeType,
  type Position,
  type BaseASTNode,
  type Range,
  type ASTNode,
  type IdentifierNode,
  type LiteralNode,
  type TemporalLiteralNode,
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
export { pprint } from './utils/pprint';

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
  private preserveTriviaEffective = false;
  private errors?: ParseError[];
  private input: string;
  // Trivia and token indexes for LSP mode with trivia preservation
  private leadingTriviaByTokenStart?: Map<number, TriviaInfo[]>;
  private trailingTriviaByTokenEnd?: Map<number, TriviaInfo[]>;
  private tokenByStart?: Map<number, Token>;
  private tokenByEnd?: Map<number, Token>;
  
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
    this.preserveTriviaEffective = !!lexerOptions.preserveTrivia;
    
    this.lexer = new Lexer(input, lexerOptions);
    this.tokens = this.lexer.tokenize();
    
    // If preserving trivia, capture leading/trailing trivia spans before filtering
    if (this.preserveTriviaEffective) {
      const spans = computeTriviaSpans(this.tokens);
      this.leadingTriviaByTokenStart = spans.leadingByStart;
      this.trailingTriviaByTokenEnd = spans.trailingByEnd;
      this.tokenByStart = spans.tokenByStart;
      this.tokenByEnd = spans.tokenByEnd;
      // Then filter hidden-channel tokens out for parsing
      this.tokens = this.tokens.filter(token => token.channel === undefined || token.channel === Channel.DEFAULT);
    }
    
    // Make mode/options/input available before cursor injection decisions
    this.input = input;
    this.mode = mode;
    this.options = options;

    // Inject cursor token if cursor position is provided
    if (options.cursorPosition !== undefined) {
      this.tokens = this.injectCursorToken(this.tokens, options.cursorPosition);
    }
    
    // Initialize LSP features only if needed
    if (this.mode === 'lsp') {
      this.errors = [];
      // indexes are now built by the augmentor
    }
  }

  // removed unused checkCursor(); cursor handling is contextual in parse methods
  
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
        // Only materialize mid-token cursor in LSP mode; otherwise ignore
        if (this.mode === 'lsp') {
          insertIndex = i;
          break;
        } else {
          return tokens;
        }
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
    // indexes will be built by augmentor
    
    let ast: ASTNode;
    
    try {
      ast = this.expression();
      
      if (!this.isAtEnd()) {
        const token = this.peek();
        this.addError(Errors.unexpectedToken(token.value || TokenType[token.type], this.getRangeFromToken(token)).message, token);
      }
      
      // No transform here; augmentor handles cursor-specific transforms
    } catch (error) {
      // In LSP mode, create error node on fatal errors
      if (error instanceof Error) {
        ast = this.createErrorNode(error.message, this.peek());
      } else {
        ast = this.createErrorNode('Parse failed', this.peek());
      }
    }
    
    // Augment AST for LSP consumers
    const aug = augment(ast, {
      input: this.input,
      preserveTrivia: this.preserveTriviaEffective,
      trivia: this.preserveTriviaEffective ? {
        leadingByStart: this.leadingTriviaByTokenStart,
        trailingByEnd: this.trailingTriviaByTokenEnd,
      } : undefined,
      cursorPosition: this.options.cursorPosition,
    });

    const result: ParseResult = {
      ast: aug.ast,
      errors: this.errors!,
      indexes: aug.indexes,
    };
    
    // Add cursor context if partial parsing
    if (this.options.partialParse) {
      const nodeAtCursor = findNodeAtPosition(aug.ast, this.options.partialParse.cursorPosition);
      result.cursorContext = {
        node: nodeAtCursor,
        expectedTokens: lspGetExpectedTokens(nodeAtCursor),
        availableCompletions: lspGetCompletions(nodeAtCursor, aug.indexes.identifiers)
      };
    }
    
    return result;
  }

  // Trivia population moved to augmentor
  
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
          if (this.mode === 'lsp') {
            const cursorTok = this.advance();
            const cursorIndex = createCursorIndexNode(cursorTok.start) as any;
            this.consume(TokenType.RBRACKET, "Expected ']'");
            left = this.createIndexNode(left, cursorIndex, token);
          } else {
            this.advance();
            left = createCursorIndexNode(this.previous().start) as any;
          }
        } else {
          const index = this.expression();
          this.consume(TokenType.RBRACKET, "Expected ']'");
          left = this.createIndexNode(left, index, token);
        }
        continue;
      }
      
      if (token.type === TokenType.LPAREN && this.isFunctionCall(left)) {
        // Function calls - always bind tightly, handled via shared helper
        left = this.parseFunctionCall(left);
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

    // Quantity literal emitted by lexer
    if (token.type === TokenType.QUANTITY) {
      this.current++;
      const raw = token.value;
      const quoteIdx = raw.indexOf("'");
      const numberPart = quoteIdx >= 0 ? raw.slice(0, quoteIdx).trim() : raw;
      const unitPart = quoteIdx >= 0 ? raw.slice(quoteIdx) : '';
      const numberValue = Number(numberPart);
      const unit = unitPart ? this.parseStringValue(unitPart) : '';
      return this.createQuantityNode(numberValue, unit, token, token);
    }

    if (token.type === TokenType.NUMBER) {
      this.current++; // inline advance()
      const numberValue = parseFloat(token.value);
      
      // Check if next token is a string (quantity unit)
      const nextToken = this.peek();
      if (nextToken.type === TokenType.STRING || nextToken.type === TokenType.DOUBLE_QUOTED_STRING) {
        this.advance();
        const unit = this.parseStringValue(nextToken.value);
        return this.createQuantityNode(numberValue, unit, token, nextToken);
      }
      
      // Check if next token is a calendar duration identifier
      if (nextToken.type === TokenType.IDENTIFIER) {
        const calendarUnits = ['year', 'years', 'month', 'months', 'week', 'weeks', 
                              'day', 'days', 'hour', 'hours', 'minute', 'minutes', 
                              'second', 'seconds', 'millisecond', 'milliseconds'];
        if (calendarUnits.includes(nextToken.value)) {
          this.advance();
          return this.createQuantityNode(numberValue, nextToken.value, token, nextToken);
        }
      }
      
      // Determine if this is an integer or decimal based on the original token text
      // If the token contains a decimal point, it's a decimal even if the value is a whole number
      const isDecimal = token.value.includes('.');
      return this.createLiteralNode(numberValue, isDecimal ? 'decimal' : 'number', token);
    }

    if (token.type === TokenType.STRING || token.type === TokenType.DOUBLE_QUOTED_STRING) {
      this.current++; // inline advance()
      const value = this.parseStringValue(token.value);
      const node = this.createLiteralNode(value, 'string', token);
      if (token.type === TokenType.DOUBLE_QUOTED_STRING) {
        node.raw = token.value;
      }
      return node;
    }

    if (token.type === TokenType.IDENTIFIER && (token.value === 'true' || token.value === 'false')) {
      this.advance();
      return this.createLiteralNode(token.value === 'true', 'boolean', token);
    }

    if (token.type === TokenType.IDENTIFIER && token.value === 'null') {
      this.advance();
      return this.createLiteralNode(null, 'null', token);
    }

    if (token.type === TokenType.DATE) {
      this.advance();
      const value = token.value.substring(1); // Remove @
      return this.createTemporalLiteralNode(value, 'date', token);
    }

    if (token.type === TokenType.DATETIME) {
      this.advance();
      const value = token.value.substring(1); // Remove @
      return this.createTemporalLiteralNode(value, 'datetime', token);
    }

    if (token.type === TokenType.TIME) {
      this.advance();
      const value = token.value.substring(1); // Remove @
      return this.createTemporalLiteralNode(value, 'time', token);
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
      // If cursor is exactly at end of identifier and no whitespace at cursor, treat as identifier context
      if (this.options.cursorPosition !== undefined && this.options.cursorPosition === token.end) {
        const ch = this.input[this.options.cursorPosition];
        const isWs = ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === undefined;
        if (!isWs) {
          this.advance();
          return createCursorIdentifierNode(this.options.cursorPosition, token.value) as any;
        }
      }
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
    return this.handleAstError(error.message, token);
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
      // Check for cursor at the end of an identifier
      if (this.options.cursorPosition !== undefined && this.options.cursorPosition === token.end) {
        this.advance();
        return createCursorIdentifierNode(this.options.cursorPosition, token.value) as any;
      }

      this.advance();
      const name = this.parseIdentifierValue(token.value);
      const node = this.createIdentifierNode(name, token);
      
      // Check if this is a function call
      if (this.check(TokenType.LPAREN)) {
        return this.parseFunctionCall(node);
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
    return this.handleAstError(error.message, token);
  }
  
  protected parseArgumentList(functionName?: string): ASTNode[] {
    const args: ASTNode[] = [];
    
    // Check for cursor at start of arguments
    if (this.peek().type === TokenType.CURSOR) {
      this.advance();
      const fn = functionName ?? '';
      args.push(createCursorArgumentNode(this.previous().start, fn, 0) as any);
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
        const fn = functionName ?? '';
        args.push(createCursorArgumentNode(this.previous().start, fn, args.length) as any);
        return args;
      }
      args.push(this.expression());
    }

    return args;
  }
  
  // Shared function-call parser for both standalone and dotted calls
  protected parseFunctionCall(nameNode: ASTNode): ASTNode {
    // Current token is '(' per caller contract
    this.advance();
    const fnName = (nameNode as any)?.name && (typeof (nameNode as any).name === 'string')
      ? (nameNode as any).name as string
      : undefined;
    const args = this.parseArgumentList(fnName);
    this.consume(TokenType.RPAREN, "Expected ')'");
    return this.createFunctionNode(nameNode, args);
  }
  
  protected parseCollectionElements(): ASTNode[] {
    const elements: ASTNode[] = [];
    
    if (this.peek().type === TokenType.RBRACE) {
      return elements; // Empty collection {} is valid
    }

    // Any other token is an error - braces can only contain empty collections
    const unexpectedToken = this.peek();
    const message = `Unexpected token '${unexpectedToken.value}', expected '}'. Braces can only be used for empty collections. Use parentheses and pipe operators for non-empty collections: (1 | 2 | 3)`;
    return this.handleAstError(message, unexpectedToken) as any;
  }
  
  protected parseTypeName(): string {
    const token = this.advance();
    if (token.type !== TokenType.IDENTIFIER) {
      const tokenStr = token.value || TokenType[token.type];
      const range = this.getRangeFromToken(token);
      const error = Errors.expectedTypeName(tokenStr, range);
      if (this.mode === 'lsp' && this.options.errorRecovery) {
        this.reportError(error.message, token);
        return '';
      }
      this.throwSyntax(error.message, token);
      return '';
    }
    return this.parseIdentifierValue(token.value);
  }
  
  protected parseStringValue(raw: string): string {
    // Remove quotes and handle escape sequences
    const content = raw.slice(1, -1);
    
    // Handle unicode escapes first (\uXXXX)
    let result = content.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
    
    // Then handle other escape sequences
    result = result.replace(/\\(.)/g, (_, char) => {
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
    
    return result;
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
    return (node as any).type === NodeType.Identifier;
  }
  
  // removed unused: isBinaryOperatorToken, isKeywordAllowedAsMember, isKeywordAllowedAsIdentifier
  
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
    if (this.check(type)) {
      return this.advance();
    }
    // If we are in recovery mode (LSP + errorRecovery), report and return a synthetic token
    if (this.mode === 'lsp' && this.options.errorRecovery) {
      const tok = this.peek();
      this.reportError(message, tok);
      // Create a zero-width synthetic token of the expected type at the current position
      const pos = this.isAtEnd() ? this.input.length : tok.start;
      const synthetic: Token = {
        type,
        value: '',
        start: pos,
        end: pos,
        line: tok?.line ?? 0,
        column: tok?.column ?? 0,
        range: {
          start: { line: 0, character: pos, offset: pos },
          end: { line: 0, character: pos, offset: pos }
        }
      } as Token;
      return synthetic;
    }
    // Be lenient when cursor is provided and we're at EOF (legacy behavior for simple mode cursor tests)
    if (this.options.cursorPosition !== undefined && this.isAtEnd()) {
      const pos = this.input.length;
      const synthetic: Token = {
        type,
        value: '',
        start: pos,
        end: pos,
        line: 0,
        column: 0,
        range: {
          start: { line: 0, character: pos, offset: pos },
          end: { line: 0, character: pos, offset: pos }
        }
      } as Token;
      return synthetic;
    }
    // Simple mode: throw
    this.throwSyntax(message, this.peek());
  }

  // Implement node creation methods
  protected createIdentifierNode(name: string, token: Token): ASTNode {
    const range = this.getRangeFromToken(token);
    const node: ASTNode = {
      type: NodeType.Identifier,
      name,
      range
    } as any;
    return node;
  }

  protected createLiteralNode(value: any, valueType: LiteralNode['valueType'], token: Token): LiteralNode {
    const node: LiteralNode = {
      type: NodeType.Literal,
      value,
      valueType,
      range: this.getRangeFromToken(token)
    };
    
    // LSP enrichment handled by augmentor
    
    return node;
  }

  protected createTemporalLiteralNode(rawValue: string, valueType: TemporalLiteralNode['valueType'], token: Token): TemporalLiteralNode {
    // Parse temporal value immediately
    const temporalValue = parseTemporalLiteral('@' + rawValue);
    
    const node: TemporalLiteralNode = {
      type: NodeType.TemporalLiteral,
      value: temporalValue,
      valueType,
      rawValue,
      range: this.getRangeFromToken(token)
    };
    
    // LSP enrichment handled by augmentor
    
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
    
    // LSP enrichment handled by augmentor
    
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
    
    // LSP enrichment handled by augmentor
    
    return node;
  }

  protected createFunctionNode(name: ASTNode, args: ASTNode[]): FunctionNode {
    const endNode = args.length > 0 ? args[args.length - 1]! : name;
    const node: FunctionNode = {
      type: NodeType.Function,
      name,
      arguments: args,
      range: this.getRangeFromNodes(name, endNode)
    };
    
    // LSP enrichment handled by augmentor
    
    return node;
  }

  protected createVariableNode(name: string, token: Token): VariableNode {
    const node: VariableNode = {
      type: NodeType.Variable,
      name,
      range: this.getRangeFromToken(token)
    };
    
    // LSP enrichment handled by augmentor
    
    return node;
  }

  protected createIndexNode(expression: ASTNode, index: ASTNode, startToken: Token): IndexNode {
    const node: IndexNode = {
      type: NodeType.Index,
      expression,
      index,
      range: this.getRangeFromNodes(expression, index)
    };
    
    // LSP enrichment handled by augmentor
    
    return node;
  }


  protected createMembershipTestNode(expression: ASTNode, targetType: string, startToken: Token): MembershipTestNode {
    // The range should extend from expression start to the end of the type name
    const endToken = this.previous(); // Should be the type identifier
    const node: MembershipTestNode = {
      type: NodeType.MembershipTest,
      expression,
      targetType,
      range: { start: expression.range.start, end: this.getRangeFromToken(endToken).end }
    };
    
    // LSP enrichment handled by augmentor
    
    return node;
  }

  protected createTypeCastNode(expression: ASTNode, targetType: string, startToken: Token): TypeCastNode {
    // The range should extend from expression start to the end of the type name
    const endToken = this.previous(); // Should be the type identifier
    const node: TypeCastNode = {
      type: NodeType.TypeCast,
      expression,
      targetType,
      range: { start: expression.range.start, end: this.getRangeFromToken(endToken).end }
    };
    
    // LSP enrichment handled by augmentor
    
    return node;
  }

  protected createCollectionNode(elements: ASTNode[], startToken: Token): CollectionNode {
    const endToken = this.previous(); // Should be RBRACE
    const node: CollectionNode = {
      type: NodeType.Collection,
      elements,
      range: this.getRangeFromTokens(startToken, endToken)
    };
    
    // LSP enrichment handled by augmentor
    
    return node;
  }

  protected createQuantityNode(value: number, unit: string, startToken: Token, endToken: Token): QuantityNode {
    const node: QuantityNode = {
      type: NodeType.Quantity,
      value,
      unit,
      range: this.getRangeFromTokens(startToken, endToken)
    };
    
    // LSP enrichment handled by augmentor
    
    return node;
  }

  // AST-level error handler: returns an ErrorNode in recovery, throws in simple mode
  protected handleAstError(message: string, token?: Token): ErrorNode {
    if (this.mode === 'lsp' && this.options.errorRecovery) {
      this.reportError(message, token);
      // Attempt to synchronize so the parse can continue
      this.synchronize();
      return this.createErrorNode(message, token);
    }
    this.throwSyntax(message, token);
  }

  // Record an error (LSP path)
  private reportError(message: string, token?: Token): void {
    this.addError(message, token);
  }

  // Throw a syntax error (simple mode path)
  private throwSyntax(message: string, token?: Token): never {
    const range = token ? this.getRangeFromToken(token) : undefined;
    if (message.includes('Unexpected token:')) {
      const tokenMatch = message.match(/Unexpected token: (.+)/);
      const tokenValue = tokenMatch?.[1] ?? 'unknown';
      throw Errors.unexpectedToken(tokenValue, range);
    }
    throw Errors.invalidSyntax(message, range);
  }
  
  // LSP enrichment moved to augmentor
  
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
    
    // LSP enrichment handled by augmentor
    
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
  
  // Cursor-specific transforms moved to augmentor
  // Cursor services moved to lsp/cursor-services
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
// moved to src/utils/pprint
