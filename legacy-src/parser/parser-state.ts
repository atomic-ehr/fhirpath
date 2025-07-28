import { TokenType } from '../lexer/token';
import type { Token } from '../lexer/token';

/**
 * Manages parser state and recovery operations
 */
export class ParserState {
  private isPartial: boolean = false;
  private currentContext: string = 'Expression';

  /**
   * Mark the parse result as partial (incomplete due to errors)
   */
  markPartial(): void {
    this.isPartial = true;
  }

  /**
   * Check if the parse result is partial
   */
  getIsPartial(): boolean {
    return this.isPartial;
  }

  /**
   * Set current parsing context for better error messages
   */
  setContext(context: string): void {
    this.currentContext = context;
  }

  /**
   * Get current parsing context
   */
  getContext(): string {
    return this.currentContext;
  }

  /**
   * Check if a token is a synchronization point for error recovery
   */
  static isSyncPoint(token: Token): boolean {
    const syncTokens = new Set([
      TokenType.COMMA,
      TokenType.RPAREN,
      TokenType.RBRACKET,
      TokenType.RBRACE,
      TokenType.EOF,
      TokenType.EOF
    ]);
    return syncTokens.has(token.type);
  }

  /**
   * Check if a token represents a statement boundary
   */
  static isStatementBoundary(token: Token): boolean {
    return token.type === TokenType.EOF ||
           token.type === TokenType.RBRACE;
  }

  /**
   * Check if a token type is an operator keyword
   */
  static isOperatorKeyword(type: TokenType): boolean {
    const operatorKeywords = new Set([
      TokenType.AND,
      TokenType.OR,
      TokenType.XOR,
      TokenType.IMPLIES,
      TokenType.AS,
      TokenType.IS,
      TokenType.MOD,
      TokenType.DIV,
      TokenType.IN,
      TokenType.CONTAINS
    ]);
    return operatorKeywords.has(type);
  }

  /**
   * Check if a token type is a literal
   */
  static isLiteral(type: TokenType): boolean {
    return type === TokenType.NUMBER ||
           type === TokenType.STRING ||
           type === TokenType.TRUE ||
           type === TokenType.FALSE ||
           type === TokenType.LITERAL;
  }

  /**
   * Check if a token can start an expression
   */
  static canStartExpression(token: Token): boolean {
    const startTokens = new Set([
      TokenType.IDENTIFIER,
      TokenType.NUMBER,
      TokenType.STRING,
      TokenType.TRUE,
      TokenType.FALSE,
      TokenType.LPAREN,
      TokenType.LBRACE,
      TokenType.LBRACKET,
      TokenType.PLUS,
      TokenType.MINUS,
      TokenType.NOT,
      TokenType.ENV_VAR,
      TokenType.LITERAL
    ]);
    return startTokens.has(token.type);
  }

  /**
   * Get expected tokens for a given context
   */
  static getExpectedTokens(context: string): TokenType[] {
    switch (context) {
      case 'FunctionCall':
        return [TokenType.IDENTIFIER, TokenType.NUMBER, TokenType.STRING, 
                TokenType.LPAREN, TokenType.LBRACE];
      case 'TypeCast':
      case 'MembershipTest':
        return [TokenType.IDENTIFIER];
      case 'Collection':
        return [TokenType.IDENTIFIER, TokenType.NUMBER, TokenType.STRING, 
                TokenType.TRUE, TokenType.FALSE, TokenType.RBRACE];
      case 'Index':
        return [TokenType.NUMBER, TokenType.IDENTIFIER, TokenType.RBRACKET];
      default:
        return [TokenType.EOF];
    }
  }
}