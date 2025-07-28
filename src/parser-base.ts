import { Lexer, TokenType } from './lexer';
import type { Token, LexerOptions } from './lexer';

// Re-export AST types that are shared
export interface Position {
  line: number;
  column: number;
  offset: number;
}

export enum NodeType {
  // Navigation
  Identifier,
  TypeOrIdentifier,
  
  // Operators
  Binary,
  Unary,
  
  // Functions
  Function,
  
  // Literals
  Literal,
  Variable,
  Collection,
  
  // Type operations
  MembershipTest,
  TypeCast,
  TypeReference,
  
  // Special
  Index,
}

// Base node interface - subclasses can extend this
export interface BaseASTNode {
  type: NodeType;
  position?: Position; // Make position optional for flexibility
}

/**
 * Abstract base parser with shared parsing logic
 * Subclasses must implement node creation and error handling
 */
export abstract class BaseParser<TNode extends { type: NodeType; position?: Position; offset?: number } = BaseASTNode> {
  protected lexer: Lexer;
  protected tokens: Token[] = [];
  protected current = 0;
  
  constructor(input: string, lexerOptions?: LexerOptions) {
    this.lexer = new Lexer(input, lexerOptions);
    this.tokens = this.lexer.tokenize();
  }
  
  // Abstract methods that subclasses must implement
  protected abstract createIdentifierNode(name: string, token: Token): TNode;
  protected abstract createLiteralNode(value: any, valueType: 'string' | 'number' | 'boolean' | 'date' | 'time' | 'datetime' | 'null', token: Token): TNode;
  protected abstract createBinaryNode(token: Token, left: TNode, right: TNode): TNode;
  protected abstract createUnaryNode(token: Token, operand: TNode): TNode;
  protected abstract createFunctionNode(name: TNode, args: TNode[], position: Position): TNode;
  protected abstract createVariableNode(name: string, token: Token): TNode;
  protected abstract createIndexNode(expression: TNode, index: TNode, position: Position): TNode;
  protected abstract createMembershipTestNode(expression: TNode, targetType: string, position: Position): TNode;
  protected abstract createTypeCastNode(expression: TNode, targetType: string, position: Position): TNode;
  protected abstract createCollectionNode(elements: TNode[], position: Position): TNode;
  protected abstract handleError(message: string, token?: Token): never | TNode;
  
  // Shared expression parsing with precedence climbing
  protected expression(): TNode {
    return this.parseExpressionWithPrecedence(0);
  }
  
  protected parseExpressionWithPrecedence(minPrecedence: number): TNode {
    let left = this.parsePrimary();

    // Inline isAtEnd() and peek() for hot path
    while (this.current < this.tokens.length) {
      const token = this.tokens[this.current];
      if (!token || token.type === TokenType.EOF) break;
      
      const precedence = this.getPrecedence(token.type);
      
      if (precedence < minPrecedence) break;

      if (token.type === TokenType.DOT) {
        this.current++; // inline advance()
        const right = this.parseInvocation();
        left = this.createBinaryNode(token, left, right);
      } else if (this.isBinaryOperator(token.type)) {
        this.current++; // inline advance()
        const associativity = this.getAssociativity(token.type);
        const nextMinPrecedence = associativity === 'left' ? precedence + 1 : precedence;
        const right = this.parseExpressionWithPrecedence(nextMinPrecedence);
        
        left = this.createBinaryNode(token, left, right);
      } else if (token.type === TokenType.IS) {
        this.current++; // inline advance()
        const typeName = this.parseTypeName();
        left = this.createMembershipTestNode(left, typeName, this.getPosition(token));
      } else if (token.type === TokenType.AS) {
        this.current++; // inline advance()
        const typeName = this.parseTypeName();
        left = this.createTypeCastNode(left, typeName, this.getPosition(token));
      } else if (token.type === TokenType.LBRACKET) {
        this.current++; // inline advance()
        const index = this.expression();
        this.consume(TokenType.RBRACKET, "Expected ']'");
        left = this.createIndexNode(left, index, this.getPosition(token));
      } else if (token.type === TokenType.LPAREN && this.isFunctionCall(left)) {
        this.current++; // inline advance()
        const args = this.parseArgumentList();
        this.consume(TokenType.RPAREN, "Expected ')'");
        left = this.createFunctionNode(left, args, this.getPositionFromNode(left));
      } else {
        break;
      }
    }

    return left;
  }
  
  protected parsePrimary(): TNode {
    // Inline peek() for hot path
    const token = this.current < this.tokens.length ? this.tokens[this.current]! : { type: TokenType.EOF, start: 0, end: 0, line: 1, column: 1 };

    if (token.type === TokenType.NUMBER) {
      this.current++; // inline advance()
      return this.createLiteralNode(parseFloat(this.lexer.getTokenValue(token)), 'number', token);
    }

    if (token.type === TokenType.STRING) {
      this.current++; // inline advance()
      const value = this.parseStringValue(this.lexer.getTokenValue(token));
      return this.createLiteralNode(value, 'string', token);
    }

    if (token.type === TokenType.TRUE || token.type === TokenType.FALSE) {
      this.advance();
      return this.createLiteralNode(token.type === TokenType.TRUE, 'boolean', token);
    }

    if (token.type === TokenType.NULL || (token.type === TokenType.IDENTIFIER && this.lexer.getTokenValue(token) === 'null')) {
      this.advance();
      return this.createLiteralNode(null, 'null', token);
    }

    if (token.type === TokenType.DATETIME) {
      this.advance();
      const value = this.lexer.getTokenValue(token).substring(1); // Remove @
      return this.createLiteralNode(value, 'datetime', token);
    }

    if (token.type === TokenType.TIME) {
      this.advance();
      const value = this.lexer.getTokenValue(token).substring(1); // Remove @
      return this.createLiteralNode(value, 'time', token);
    }

    if (token.type === TokenType.THIS || token.type === TokenType.INDEX || token.type === TokenType.TOTAL) {
      this.advance();
      return this.createVariableNode(this.lexer.getTokenValue(token), token);
    }

    if (token.type === TokenType.ENV_VAR) {
      this.advance();
      const value = this.lexer.getTokenValue(token);
      return this.createVariableNode(value, token);
    }

    if (token.type === TokenType.IDENTIFIER || 
        token.type === TokenType.DELIMITED_IDENTIFIER ||
        this.isKeywordAllowedAsIdentifier(token.type)) {
      this.advance();
      const name = this.parseIdentifierValue(this.lexer.getTokenValue(token));
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
      return this.createCollectionNode(elements, this.getPosition(token));
    }

    if (token.type === TokenType.PLUS || token.type === TokenType.MINUS) {
      this.advance();
      const operand = this.parseExpressionWithPrecedence(this.getPrecedence(TokenType.MULTIPLY));
      return this.createUnaryNode(token, operand);
    }

    return this.handleError(`Unexpected token: ${this.lexer.getTokenValue(token)}`, token);
  }
  
  protected parseInvocation(): TNode {
    const token = this.peek();
    
    // Allow identifiers and keywords that can be used as member names
    if (token.type === TokenType.IDENTIFIER || 
        token.type === TokenType.DELIMITED_IDENTIFIER ||
        this.isKeywordAllowedAsMember(token.type)) {
      this.advance();
      const name = this.parseIdentifierValue(this.lexer.getTokenValue(token));
      const node = this.createIdentifierNode(name, token);
      
      // Check if this is a function call
      if (this.check(TokenType.LPAREN)) {
        this.advance();
        const args = this.parseArgumentList();
        this.consume(TokenType.RPAREN, "Expected ')'");
        return this.createFunctionNode(node, args, this.getPositionFromNode(node));
      }
      
      return node;
    }
    
    // Allow environment variables after dot (like .%resource)
    if (token.type === TokenType.ENV_VAR) {
      this.advance();
      const value = this.lexer.getTokenValue(token);
      return this.createVariableNode(value, token);
    }

    return this.handleError(`Expected identifier after '.', got: ${this.lexer.getTokenValue(token)}`, token);
  }
  
  protected parseArgumentList(): TNode[] {
    const args: TNode[] = [];
    
    if (this.peek().type === TokenType.RPAREN) {
      return args;
    }

    args.push(this.expression());
    
    while (this.match(TokenType.COMMA)) {
      args.push(this.expression());
    }

    return args;
  }
  
  protected parseCollectionElements(): TNode[] {
    const elements: TNode[] = [];
    
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
    if (token.type !== TokenType.IDENTIFIER && token.type !== TokenType.DELIMITED_IDENTIFIER) {
      this.handleError(`Expected type name, got: ${this.lexer.getTokenValue(token)}`, token);
      return ''; // For TypeScript, though handleError should throw/return error node
    }
    return this.parseIdentifierValue(this.lexer.getTokenValue(token));
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
  
  protected getPositionFromNode(node: TNode): Position {
    if ('position' in node && node.position) {
      return node.position;
    }
    if ('offset' in node && typeof node.offset === 'number') {
      return { line: 0, column: 0, offset: node.offset };
    }
    return { line: 0, column: 0, offset: 0 };
  }
  
  // Shared utility methods
  protected isFunctionCall(node: TNode): boolean {
    return (node as any).type === NodeType.Identifier || (node as any).type === NodeType.TypeOrIdentifier;
  }
  
  protected isBinaryOperator(type: TokenType): boolean {
    return [
      TokenType.PLUS, TokenType.MINUS, TokenType.MULTIPLY, TokenType.DIVIDE,
      TokenType.DIV, TokenType.MOD, TokenType.AMPERSAND, TokenType.PIPE,
      TokenType.LT, TokenType.GT, TokenType.LTE, TokenType.GTE,
      TokenType.EQ, TokenType.NEQ, TokenType.SIMILAR, TokenType.NOT_SIMILAR,
      TokenType.AND, TokenType.OR, TokenType.XOR, TokenType.IMPLIES,
      TokenType.IN, TokenType.CONTAINS
    ].includes(type);
  }
  
  protected getPrecedence(type: TokenType): number {
    // Extract precedence from high byte using bit shift
    return type >>> 8;
  }
  
  protected getAssociativity(type: TokenType): 'left' | 'right' {
    // Most operators are left associative
    // Only implies is right associative
    return type === TokenType.IMPLIES ? 'right' : 'left';
  }
  
  protected getPosition(token: Token): Position {
    return {
      line: token.line,
      column: token.column,
      offset: token.start
    };
  }
  
  protected isKeywordAllowedAsMember(type: TokenType): boolean {
    // Keywords that can be used as member names
    return [
      TokenType.CONTAINS,
      TokenType.AND,
      TokenType.OR,
      TokenType.XOR,
      TokenType.IMPLIES,
      TokenType.AS,
      TokenType.IS,
      TokenType.DIV,
      TokenType.MOD,
      TokenType.IN,
      TokenType.TRUE,
      TokenType.FALSE
    ].includes(type);
  }
  
  protected isKeywordAllowedAsIdentifier(type: TokenType): boolean {
    // Keywords that can be used as identifiers in certain contexts
    return this.isKeywordAllowedAsMember(type);
  }
  
  // Helper methods
  protected peek(): Token {
    return this.tokens[this.current] || { type: TokenType.EOF, start: 0, end: 0, line: 1, column: 1 };
  }
  
  protected previous(): Token {
    return this.tokens[this.current - 1] || { type: TokenType.EOF, start: 0, end: 0, line: 1, column: 1 };
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
    return this.handleError(message + ` at token: ${this.lexer.getTokenValue(this.peek())}`, this.peek()) as any;
  }
}