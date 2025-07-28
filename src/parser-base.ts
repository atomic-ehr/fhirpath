import { Lexer, TokenType, Channel, isOperator, isOperatorValue } from './lexer';
import type { Token, LexerOptions } from './lexer';
import { registry } from './registry';

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
    
    // Filter out trivia tokens if they exist (tokens on hidden channel)
    if (lexerOptions?.preserveTrivia) {
      this.tokens = this.tokens.filter(token => 
        token.channel === undefined || token.channel === Channel.DEFAULT
      );
    }
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
        const typeName = this.parseTypeName();
        left = this.createMembershipTestNode(left, typeName, this.getPosition(token));
      } else if (token.type === TokenType.IDENTIFIER && token.value === 'as') {
        this.current++; // inline advance()
        const typeName = this.parseTypeName();
        left = this.createTypeCastNode(left, typeName, this.getPosition(token));
      } else if (operator && registry.isBinaryOperator(operator)) {
        this.current++; // inline advance()
        const associativity = registry.getAssociativity(operator);
        const nextMinPrecedence = associativity === 'left' ? precedence + 1 : precedence;
        const right = this.parseExpressionWithPrecedence(nextMinPrecedence);
        
        left = this.createBinaryNode(token, left, right);
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
    const token = this.current < this.tokens.length ? this.tokens[this.current]! : { type: TokenType.EOF, value: '', start: 0, end: 0, line: 1, column: 1 };

    if (token.type === TokenType.NUMBER) {
      this.current++; // inline advance()
      return this.createLiteralNode(parseFloat(token.value), 'number', token);
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
      return this.createCollectionNode(elements, this.getPosition(token));
    }

    // Handle unary operators
    if (token.type === TokenType.OPERATOR && (token.value === '+' || token.value === '-')) {
      this.advance();
      const operand = this.parseExpressionWithPrecedence(registry.getPrecedence('*'));
      return this.createUnaryNode(token, operand);
    }

    return this.handleError(`Unexpected token: ${token.value || TokenType[token.type]}`, token);
  }
  
  protected parseInvocation(): TNode {
    const token = this.peek();
    
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
        return this.createFunctionNode(node, args, this.getPositionFromNode(node));
      }
      
      return node;
    }
    
    // Allow environment variables after dot (like .%resource)
    if (token.type === TokenType.ENVIRONMENT_VARIABLE) {
      this.advance();
      return this.createVariableNode(token.value, token);
    }

    return this.handleError(`Expected identifier after '.', got: ${token.value || TokenType[token.type]}`, token);
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
    if (token.type !== TokenType.IDENTIFIER) {
      this.handleError(`Expected type name, got: ${token.value || TokenType[token.type]}`, token);
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
  
  protected getPosition(token: Token): Position {
    return {
      line: token.line,
      column: token.column,
      offset: token.start
    };
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
    const token = this.peek();
    return this.handleError(message + ` at token: ${token.value || TokenType[token.type]}`, token) as any;
  }
}