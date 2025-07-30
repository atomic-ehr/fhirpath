/**
 * Simplified FHIRPath Lexer
 * 
 * This lexer only recognizes:
 * - Symbol operators: +, -, *, /, <, >, =, etc. (all as OPERATOR tokens)
 * - Structural tokens: (, ), [, ], {, }, ., ,
 * - Literals: numbers, strings, datetime, time
 * - Identifiers: any alphabetic sequence (including all keywords)
 * - Special identifiers: $... (context variables like $this, $index)
 * - Environment variables: %identifier, %`delimited`, %'string'
 * 
 * The parser is responsible for determining which identifiers are keyword operators.
 */

export enum TokenType {
  // Special
  EOF = 0,
  
  // Literals
  IDENTIFIER = 1,
  NUMBER = 2,
  STRING = 3,
  DATETIME = 4,
  TIME = 5,
  
  // Operators (all symbol operators consolidated)
  OPERATOR = 10,    // +, -, *, /, <, >, <=, >=, =, !=, ~, !~, |, &
  
  // Structural
  DOT = 50,         // .
  COMMA = 51,       // ,
  LPAREN = 52,      // (
  RPAREN = 53,      // )
  LBRACKET = 54,    // [
  RBRACKET = 55,    // ]
  LBRACE = 56,      // {
  RBRACE = 57,      // }
  
  // Special tokens
  SPECIAL_IDENTIFIER = 60,     // $...
  ENVIRONMENT_VARIABLE = 70,   // %identifier, %`delimited`, %'string'
  
  // Trivia tokens
  WHITESPACE = 80,
  LINE_COMMENT = 81,
  BLOCK_COMMENT = 82,
}

export enum Channel {
  DEFAULT = 0,
  HIDDEN = 1,
}

import type { Position, Range } from './types';

export interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
  line: number;
  column: number;
  range?: Range; // LSP-compatible range
  channel?: Channel;
}

export interface LexerOptions {
  trackPosition?: boolean;
  preserveTrivia?: boolean;
}

export class Lexer {
  private input: string;
  private position: number = 0;
  private line: number = 1;     // Legacy: 1-based for backward compatibility
  private column: number = 1;   // Legacy: 1-based for backward compatibility
  private lspLine: number = 0;     // LSP: zero-based
  private lspCharacter: number = 0; // LSP: zero-based character within line
  private options: LexerOptions;
  private lineOffsets: number[] = [0]; // Start positions of each line
  
  constructor(input: string, options: LexerOptions = {}) {
    this.input = input;
    this.options = {
      trackPosition: options.trackPosition ?? true,
      preserveTrivia: options.preserveTrivia ?? false,
    };
    if (this.options.trackPosition) {
      this.buildLineOffsets();
    }
  }
  
  /**
   * Build line offset map for efficient position conversions
   */
  private buildLineOffsets(): void {
    this.lineOffsets = [0];
    
    for (let i = 0; i < this.input.length; i++) {
      const char = this.input[i];
      if (char === '\n') {
        this.lineOffsets.push(i + 1);
      } else if (char === '\r') {
        // Handle \r\n as single line ending
        if (i + 1 < this.input.length && this.input[i + 1] === '\n') {
          i++; // Skip the \n
        }
        this.lineOffsets.push(i + 1);
      }
    }
  }
  
  tokenize(): Token[] {
    const tokens: Token[] = [];
    
    while (this.position < this.input.length) {
      const token = this.nextToken();
      if (token) {
        tokens.push(token);
      }
    }
    
    // Always add EOF token
    tokens.push(this.createToken(TokenType.EOF, '', this.position, this.position));
    
    return tokens;
  }
  
  private nextToken(): Token | null {
    // Handle whitespace if preserveTrivia is enabled
    if (this.options.preserveTrivia && this.position < this.input.length) {
      const wsStart = this.position;
      const wsStartLine = this.line;
      const wsStartColumn = this.column;
      
      if (this.isWhitespace(this.current())) {
        this.skipWhitespace();
        const wsToken = this.createToken(
          TokenType.WHITESPACE, 
          this.input.substring(wsStart, this.position),
          wsStart, 
          this.position, 
          wsStartLine, 
          wsStartColumn
        );
        wsToken.channel = Channel.HIDDEN;
        return wsToken;
      }
    } else {
      // Skip whitespace normally
      this.skipWhitespace();
    }
    
    if (this.position >= this.input.length) {
      return null;
    }
    
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    const char = this.input[this.position];
    const charCode = this.input.charCodeAt(this.position);
    
    // Single character tokens
    switch (char) {
      case '+':
        this.advance();
        return this.createToken(TokenType.OPERATOR, '+', start, this.position, startLine, startColumn);
        
      case '-':
        this.advance();
        return this.createToken(TokenType.OPERATOR, '-', start, this.position, startLine, startColumn);
        
      case '*':
        this.advance();
        return this.createToken(TokenType.OPERATOR, '*', start, this.position, startLine, startColumn);
        
      case '/':
        // Check for comments
        if (this.peek() === '/') {
          if (this.options.preserveTrivia) {
            const commentStart = this.position;
            this.skipLineComment();
            const token = this.createToken(
              TokenType.LINE_COMMENT,
              this.input.substring(commentStart, this.position),
              commentStart,
              this.position,
              startLine,
              startColumn
            );
            token.channel = Channel.HIDDEN;
            return token;
          } else {
            this.skipLineComment();
            return null;
          }
        }
        if (this.peek() === '*') {
          if (this.options.preserveTrivia) {
            const commentStart = this.position;
            this.skipBlockComment();
            const token = this.createToken(
              TokenType.BLOCK_COMMENT,
              this.input.substring(commentStart, this.position),
              commentStart,
              this.position,
              startLine,
              startColumn
            );
            token.channel = Channel.HIDDEN;
            return token;
          } else {
            this.skipBlockComment();
            return null;
          }
        }
        this.advance();
        return this.createToken(TokenType.OPERATOR, '/', start, this.position, startLine, startColumn);
        
      case '<':
        this.advance();
        if (this.current() === '=') {
          this.advance();
          return this.createToken(TokenType.OPERATOR, '<=', start, this.position, startLine, startColumn);
        }
        return this.createToken(TokenType.OPERATOR, '<', start, this.position, startLine, startColumn);
        
      case '>':
        this.advance();
        if (this.current() === '=') {
          this.advance();
          return this.createToken(TokenType.OPERATOR, '>=', start, this.position, startLine, startColumn);
        }
        return this.createToken(TokenType.OPERATOR, '>', start, this.position, startLine, startColumn);
        
      case '=':
        this.advance();
        return this.createToken(TokenType.OPERATOR, '=', start, this.position, startLine, startColumn);
        
      case '!':
        this.advance();
        if (this.current() === '=') {
          this.advance();
          return this.createToken(TokenType.OPERATOR, '!=', start, this.position, startLine, startColumn);
        } else if (this.current() === '~') {
          this.advance();
          return this.createToken(TokenType.OPERATOR, '!~', start, this.position, startLine, startColumn);
        }
        // '!' alone is not a valid token in FHIRPath
        throw this.error(`Unexpected character '!' at position ${start}`);
        
      case '~':
        this.advance();
        return this.createToken(TokenType.OPERATOR, '~', start, this.position, startLine, startColumn);
        
      case '|':
        this.advance();
        return this.createToken(TokenType.OPERATOR, '|', start, this.position, startLine, startColumn);
        
      case '&':
        this.advance();
        return this.createToken(TokenType.OPERATOR, '&', start, this.position, startLine, startColumn);
        
      case '.':
        this.advance();
        return this.createToken(TokenType.DOT, '.', start, this.position, startLine, startColumn);
        
      case ',':
        this.advance();
        return this.createToken(TokenType.COMMA, ',', start, this.position, startLine, startColumn);
        
      case '(':
        this.advance();
        return this.createToken(TokenType.LPAREN, '(', start, this.position, startLine, startColumn);
        
      case ')':
        this.advance();
        return this.createToken(TokenType.RPAREN, ')', start, this.position, startLine, startColumn);
        
      case '[':
        this.advance();
        return this.createToken(TokenType.LBRACKET, '[', start, this.position, startLine, startColumn);
        
      case ']':
        this.advance();
        return this.createToken(TokenType.RBRACKET, ']', start, this.position, startLine, startColumn);
        
      case '{':
        this.advance();
        return this.createToken(TokenType.LBRACE, '{', start, this.position, startLine, startColumn);
        
      case '}':
        this.advance();
        return this.createToken(TokenType.RBRACE, '}', start, this.position, startLine, startColumn);
        
      case '%':
        return this.readEnvironmentVariable();
        
      case "'":
        return this.readString("'");
        
      case '"':
        // Not in spec but often supported
        return this.readString('"');
        
      case '`':
        return this.readDelimitedIdentifier();
        
      case '@':
        return this.readDateTimeOrTime();
        
      case '$':
        return this.readSpecialIdentifier();
    }
    
    // Numbers
    if (charCode >= 48 && charCode <= 57) { // 0-9
      return this.readNumber();
    }
    
    // Identifiers (including all keywords)
    if ((charCode >= 65 && charCode <= 90) || // A-Z
        (charCode >= 97 && charCode <= 122) || // a-z
        charCode === 95) { // _
      return this.readIdentifier();
    }
    
    throw this.error(`Unexpected character '${char}' at position ${this.position}`);
  }
  
  private readIdentifier(): Token {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    // First character is already validated
    this.advance();
    
    // Continue with alphanumeric or underscore
    while (this.position < this.input.length) {
      const charCode = this.input.charCodeAt(this.position);
      if ((charCode >= 65 && charCode <= 90) || // A-Z
          (charCode >= 97 && charCode <= 122) || // a-z
          (charCode >= 48 && charCode <= 57) || // 0-9
          charCode === 95) { // _
        this.advance();
      } else {
        break;
      }
    }
    
    const value = this.input.substring(start, this.position);
    return this.createToken(TokenType.IDENTIFIER, value, start, this.position, startLine, startColumn);
  }
  
  private readDelimitedIdentifier(): Token {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    this.advance(); // Skip opening `
    
    while (this.position < this.input.length) {
      const char = this.current();
      
      if (char === '`') {
        this.advance(); // Skip closing `
        const value = this.input.substring(start, this.position);
        return this.createToken(TokenType.IDENTIFIER, value, start, this.position, startLine, startColumn);
      }
      
      if (char === '\\') {
        this.advance(); // Skip escape character
        if (this.position >= this.input.length) {
          throw this.error('Unterminated delimited identifier');
        }
      }
      
      this.advance();
    }
    
    throw this.error('Unterminated delimited identifier');
  }
  
  private readSpecialIdentifier(): Token {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    this.advance(); // Skip $
    
    // Read the identifier part
    while (this.position < this.input.length) {
      const charCode = this.input.charCodeAt(this.position);
      if ((charCode >= 65 && charCode <= 90) || // A-Z
          (charCode >= 97 && charCode <= 122) || // a-z
          (charCode >= 48 && charCode <= 57) || // 0-9
          charCode === 95) { // _
        this.advance();
      } else {
        break;
      }
    }
    
    const value = this.input.substring(start, this.position);
    
    // All $... tokens are SPECIAL_IDENTIFIER
    return this.createToken(TokenType.SPECIAL_IDENTIFIER, value, start, this.position, startLine, startColumn);
  }
  
  private readEnvironmentVariable(): Token {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    this.advance(); // Skip %
    
    // Check what follows %
    const char = this.current();
    
    if (char === '`') {
      // Delimited identifier: %`identifier`
      this.advance(); // Skip opening `
      
      while (this.position < this.input.length) {
        const ch = this.current();
        
        if (ch === '`') {
          this.advance(); // Skip closing `
          const value = this.input.substring(start, this.position);
          return this.createToken(TokenType.ENVIRONMENT_VARIABLE, value, start, this.position, startLine, startColumn);
        }
        
        if (ch === '\\') {
          this.advance(); // Skip escape character
          if (this.position >= this.input.length) {
            throw this.error('Unterminated environment variable');
          }
        }
        
        this.advance();
      }
      
      throw this.error('Unterminated environment variable');
    } else if (char === "'") {
      // String format (backwards compatibility): %'identifier'
      this.advance(); // Skip opening '
      
      while (this.position < this.input.length) {
        const ch = this.current();
        
        if (ch === "'") {
          this.advance(); // Skip closing '
          const value = this.input.substring(start, this.position);
          return this.createToken(TokenType.ENVIRONMENT_VARIABLE, value, start, this.position, startLine, startColumn);
        }
        
        if (ch === '\\') {
          this.advance(); // Skip escape character
          if (this.position >= this.input.length) {
            throw this.error('Unterminated environment variable');
          }
        }
        
        this.advance();
      }
      
      throw this.error('Unterminated environment variable');
    } else {
      // Simple identifier: %identifier
      const charCode = this.input.charCodeAt(this.position);
      if (!((charCode >= 65 && charCode <= 90) || // A-Z
            (charCode >= 97 && charCode <= 122) || // a-z
            charCode === 95)) { // _
        throw this.error('Invalid environment variable name');
      }
      
      // Read the identifier part
      while (this.position < this.input.length) {
        const charCode = this.input.charCodeAt(this.position);
        if ((charCode >= 65 && charCode <= 90) || // A-Z
            (charCode >= 97 && charCode <= 122) || // a-z
            (charCode >= 48 && charCode <= 57) || // 0-9
            charCode === 95) { // _
          this.advance();
        } else {
          break;
        }
      }
      
      const value = this.input.substring(start, this.position);
      return this.createToken(TokenType.ENVIRONMENT_VARIABLE, value, start, this.position, startLine, startColumn);
    }
  }
  
  private readString(quote: string): Token {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    this.advance(); // Skip opening quote
    
    while (this.position < this.input.length) {
      const char = this.current();
      
      if (char === quote) {
        this.advance(); // Skip closing quote
        const value = this.input.substring(start, this.position);
        return this.createToken(TokenType.STRING, value, start, this.position, startLine, startColumn);
      }
      
      if (char === '\\') {
        this.advance(); // Skip escape character
        if (this.position >= this.input.length) {
          throw this.error('Unterminated string');
        }
        // Skip the escaped character
        this.advance();
      } else {
        this.advance();
      }
    }
    
    throw this.error('Unterminated string');
  }
  
  private readNumber(): Token {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    // Read integer part
    while (this.position < this.input.length && this.isDigit(this.current())) {
      this.advance();
    }
    
    // Check for decimal part
    if (this.current() === '.' && this.position + 1 < this.input.length && this.input[this.position + 1] && this.isDigit(this.input[this.position + 1]!)) {
      this.advance(); // Skip .
      while (this.position < this.input.length && this.isDigit(this.current())) {
        this.advance();
      }
    }
    
    const value = this.input.substring(start, this.position);
    return this.createToken(TokenType.NUMBER, value, start, this.position, startLine, startColumn);
  }
  
  private readDateTimeOrTime(): Token {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    this.advance(); // Skip @
    
    // Check if it's a time (starts with T)
    if (this.current() === 'T') {
      return this.readTime(start, startLine, startColumn);
    }
    
    // Otherwise it's a datetime
    return this.readDateTime(start, startLine, startColumn);
  }
  
  private readDateTime(start: number, startLine: number, startColumn: number): Token {
    // Year (4 digits required)
    for (let i = 0; i < 4; i++) {
      if (!this.isDigit(this.current())) {
        throw this.error('Invalid datetime format');
      }
      this.advance();
    }
    
    // Optional month, day, time parts
    if (this.current() === '-') {
      this.advance();
      // Month (2 digits)
      for (let i = 0; i < 2; i++) {
        if (!this.isDigit(this.current())) {
          throw this.error('Invalid datetime format');
        }
        this.advance();
      }
      
      if (this.current() === '-') {
        this.advance();
        // Day (2 digits)
        for (let i = 0; i < 2; i++) {
          if (!this.isDigit(this.current())) {
            throw this.error('Invalid datetime format');
          }
          this.advance();
        }
      }
    }
    
    // Optional time part
    if (this.current() === 'T') {
      this.advance();
      this.readTimeFormat();
    }
    
    // Optional timezone
    this.readTimezone();
    
    const value = this.input.substring(start, this.position);
    return this.createToken(TokenType.DATETIME, value, start, this.position, startLine, startColumn);
  }
  
  private readTime(start: number, startLine: number, startColumn: number): Token {
    this.advance(); // Skip T
    this.readTimeFormat();
    
    const value = this.input.substring(start, this.position);
    return this.createToken(TokenType.TIME, value, start, this.position, startLine, startColumn);
  }
  
  private readTimeFormat(): void {
    // Hour (2 digits)
    for (let i = 0; i < 2; i++) {
      if (!this.isDigit(this.current())) {
        return; // Time format is optional in datetime
      }
      this.advance();
    }
    
    // Optional minutes
    if (this.current() === ':') {
      this.advance();
      for (let i = 0; i < 2; i++) {
        if (!this.isDigit(this.current())) {
          throw this.error('Invalid time format');
        }
        this.advance();
      }
      
      // Optional seconds
      if (this.current() === ':') {
        this.advance();
        for (let i = 0; i < 2; i++) {
          if (!this.isDigit(this.current())) {
            throw this.error('Invalid time format');
          }
          this.advance();
        }
        
        // Optional milliseconds
        if (this.current() === '.') {
          this.advance();
          if (!this.isDigit(this.current())) {
            throw this.error('Invalid time format');
          }
          while (this.isDigit(this.current())) {
            this.advance();
          }
        }
      }
    }
  }
  
  private readTimezone(): void {
    const char = this.current();
    if (char === 'Z') {
      this.advance();
    } else if (char === '+' || char === '-') {
      this.advance();
      // Hour (2 digits)
      for (let i = 0; i < 2; i++) {
        if (!this.isDigit(this.current())) {
          return; // Timezone is optional
        }
        this.advance();
      }
      if (this.current() === ':') {
        this.advance();
        // Minutes (2 digits)
        for (let i = 0; i < 2; i++) {
          if (!this.isDigit(this.current())) {
            throw this.error('Invalid timezone format');
          }
          this.advance();
        }
      }
    }
  }
  
  private skipWhitespace(): void {
    while (this.position < this.input.length) {
      const char = this.current();
      if (char === ' ' || char === '\t' || char === '\r' || char === '\n') {
        this.advance();
      } else {
        break;
      }
    }
  }
  
  private skipLineComment(): void {
    // Skip //
    this.advance();
    this.advance();
    
    // Skip until end of line
    while (this.position < this.input.length && this.current() !== '\n') {
      this.advance();
    }
  }
  
  private skipBlockComment(): void {
    // Skip /*
    this.advance();
    this.advance();
    
    // Skip until */
    while (this.position < this.input.length) {
      if (this.current() === '*' && this.peek() === '/') {
        this.advance(); // Skip *
        this.advance(); // Skip /
        break;
      }
      this.advance();
    }
  }
  
  private advance(): void {
    if (this.position < this.input.length) {
      const char = this.input[this.position]!;
      
      if (this.options.trackPosition) {
        if (char === '\n') {
          this.line++;
          this.column = 1;
          this.lspLine++;
          this.lspCharacter = 0;
        } else if (char === '\r') {
          // Handle \r\n as single line ending
          if (this.position + 1 < this.input.length && this.input[this.position + 1] === '\n') {
            // Don't update line yet, wait for \n
          } else {
            // Standalone \r
            this.line++;
            this.column = 1;
            this.lspLine++;
            this.lspCharacter = 0;
          }
        } else {
          this.column++;
          this.lspCharacter++;
        }
      }
      this.position++;
    }
  }
  
  private current(): string {
    return this.position < this.input.length ? this.input[this.position]! : '';
  }
  
  private peek(): string {
    return this.position + 1 < this.input.length ? this.input[this.position + 1]! : '';
  }
  
  private isDigit(char: string): boolean {
    if (!char) return false;
    const code = char.charCodeAt(0);
    return code >= 48 && code <= 57; // 0-9
  }
  
  private isWhitespace(char: string): boolean {
    if (!char) return false;
    return char === ' ' || char === '\t' || char === '\n' || char === '\r';
  }
  
  /**
   * Convert absolute offset to LSP Position
   */
  private offsetToPosition(offset: number): Position {
    if (!this.options.trackPosition) {
      return { line: 0, character: 0, offset };
    }
    
    // Binary search for the line
    let low = 0;
    let high = this.lineOffsets.length - 1;
    
    while (low < high) {
      const mid = Math.floor((low + high + 1) / 2);
      if (this.lineOffsets[mid]! <= offset) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    
    const line = low;
    const lineStart = this.lineOffsets[line]!;
    const character = offset - lineStart;
    
    return { line, character, offset };
  }
  
  private createToken(
    type: TokenType,
    value: string,
    start: number,
    end: number,
    line: number = this.line,
    column: number = this.column
  ): Token {
    const token: Token = {
      type,
      value,
      start,
      end,
      line: this.options.trackPosition ? line : 0,
      column: this.options.trackPosition ? column : 0,
    };
    
    // Add LSP-compatible range if tracking positions
    if (this.options.trackPosition) {
      const startPos = this.offsetToPosition(start);
      const endPos = this.offsetToPosition(end);
      token.range = {
        start: startPos,
        end: endPos
      };
    }
    
    return token;
  }
  
  private error(message: string): Error {
    return new Error(`Lexer error: ${message}`);
  }
  
  // Public methods for parser use
  
  /**
   * Get the text value for a token
   */
  getTokenText(token: Token): string {
    return token.value;
  }
  
  /**
   * Check if a token is an identifier (including keyword operators)
   */
  static isIdentifier(token: Token): boolean {
    return token.type === TokenType.IDENTIFIER;
  }
  
  /**
   * Check if a token could be a keyword operator (parser decides)
   */
  static couldBeKeywordOperator(token: Token): boolean {
    return token.type === TokenType.IDENTIFIER;
  }
}

// Export a type-safe token type checker
export function isTokenType(token: Token, type: TokenType): boolean {
  return token.type === type;
}

// Helper to check if a token is an operator
export function isOperator(token: Token): boolean {
  return token.type === TokenType.OPERATOR;
}

// Helper to check if a token is a specific operator
export function isOperatorValue(token: Token, value: string): boolean {
  return token.type === TokenType.OPERATOR && token.value === value;
}

// Helper to check if a token is an environment variable
export function isEnvironmentVariable(token: Token): boolean {
  return token.type === TokenType.ENVIRONMENT_VARIABLE;
}