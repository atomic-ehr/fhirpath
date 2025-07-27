import type { Token } from '../lexer/token';
import { TokenType } from '../lexer/token';

/**
 * Handles token navigation and lookahead operations for the parser
 */
export class TokenNavigator {
  private tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /**
   * Check if the current token matches any of the given types
   */
  match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  /**
   * Check if the current token is of the given type
   */
  check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  /**
   * Advance to the next token and return the previous one
   */
  advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  /**
   * Check if we've reached the end of tokens
   */
  isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  /**
   * Get the current token without advancing
   */
  peek(): Token {
    if (this.tokens.length === 0) {
      // Return a synthetic EOF token when there are no tokens
      return {
        type: TokenType.EOF,
        value: '',
        position: { line: 1, column: 1, offset: 0 }
      } as Token;
    }
    return this.tokens[this.current] ?? this.tokens[this.tokens.length - 1]!;
  }

  /**
   * Get the previous token
   */
  previous(): Token {
    return this.tokens[this.current - 1]!;
  }

  /**
   * Get current position in token stream
   */
  getCurrentPosition(): number {
    return this.current;
  }

  /**
   * Restore position in token stream
   */
  restorePosition(position: number): void {
    this.current = position;
  }

  /**
   * Consume a token of the expected type or throw an error
   */
  consume(type: TokenType, errorCallback: (token: Token) => Error): Token {
    if (this.check(type)) return this.advance();
    throw errorCallback(this.peek());
  }

  /**
   * Skip tokens while a condition is true
   */
  skipWhile(condition: (token: Token) => boolean): void {
    while (!this.isAtEnd() && condition(this.peek())) {
      this.advance();
    }
  }

  /**
   * Check if any of the token types match current token
   */
  checkAny(types: TokenType[]): boolean {
    return types.some(type => this.check(type));
  }
}