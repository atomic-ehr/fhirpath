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
  QUANTITY = 6,     // Quantity literals like 5 'mg'
  DATE = 7,         // Date literals like @2020-01-01
  DOUBLE_QUOTED_STRING = 8, // "..." - not in spec but lexed for diagnostics
  
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
  CURSOR = 71,                 // Virtual cursor token for LSP support
  
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
    const char = this.input[this.position]!;
    const charCode = this.input.charCodeAt(this.position);
    
    // Single character tokens
    switch (char) {
      case '/':
        // Handle comments first; otherwise treat as operator
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
        // Fall through to operator matching after comment checks
        return this.readOperator(start, startLine, startColumn);

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
        return this.readDoubleQuotedString();
        
      case '`':
        return this.readDelimitedIdentifier();
        
      case '@':
        return this.readDateTimeOrTime();
        
      case '$':
        return this.readSpecialIdentifier();
    }

    // Greedy operator matching for other operator starters
    if (this.isOperatorStarter(char)) {
      return this.readOperator(start, startLine, startColumn);
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
    this.scanIdentifierBody();
    
    const value = this.input.substring(start, this.position);
    return this.createToken(TokenType.IDENTIFIER, value, start, this.position, startLine, startColumn);
  }
  
  private readDelimitedIdentifier(): Token {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    // Current must be opening backtick
    this.scanQuoted('`', 'Unterminated delimited identifier');
    const value = this.input.substring(start, this.position);
    return this.createToken(TokenType.IDENTIFIER, value, start, this.position, startLine, startColumn);
  }
  
  private readSpecialIdentifier(): Token {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    this.advance(); // Skip $
    
    // Read the identifier part (may be empty)
    this.scanIdentifierBody();
    
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
      this.scanQuoted('`', 'Unterminated environment variable');
      const value = this.input.substring(start, this.position);
      return this.createToken(TokenType.ENVIRONMENT_VARIABLE, value, start, this.position, startLine, startColumn);
    } else if (char === "'") {
      // String format (backwards compatibility): %'identifier'
      this.scanQuoted("'", 'Unterminated environment variable');
      const value = this.input.substring(start, this.position);
      return this.createToken(TokenType.ENVIRONMENT_VARIABLE, value, start, this.position, startLine, startColumn);
    } else {
      // Simple identifier: %identifier
      const charCode = this.input.charCodeAt(this.position);
      if (!this.isIdentifierHead(charCode)) {
        throw this.error('Invalid environment variable name');
      }
      // Consume head and the rest of identifier
      this.advance();
      this.scanIdentifierBody();
      
      const value = this.input.substring(start, this.position);
      return this.createToken(TokenType.ENVIRONMENT_VARIABLE, value, start, this.position, startLine, startColumn);
    }
  }
  
  private readString(quote: "'" | '"'): Token {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    this.scanQuoted(quote, 'Unterminated string');
    const value = this.input.substring(start, this.position);
    return this.createToken(TokenType.STRING, value, start, this.position, startLine, startColumn);
  }

  private readDoubleQuotedString(): Token {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    this.scanQuoted('"', 'Unterminated string');
    const value = this.input.substring(start, this.position);
    return this.createToken(TokenType.DOUBLE_QUOTED_STRING, value, start, this.position, startLine, startColumn);
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
    
    // Look ahead for a single-quoted unit to form a Quantity literal
    // Pattern: <number>[ \t]?'<unit>' (no newline between number and unit)
    const i = this.position;
    let j = i;
    // allow spaces/tabs only; do not cross lines
    while (j < this.input.length) {
      const ch = this.input[j]!;
      if (ch === ' ' || ch === '\t') {
        j++;
        continue;
      }
      break;
    }

    if (j < this.input.length && this.input[j] === "'") {
      // We will consume optional spaces/tabs and the quoted unit, then emit QUANTITY token
      while (this.position < j) {
        this.advance();
      }
      // Current is the opening quote; scan quoted unit including escapes
      this.scanQuoted("'", 'Unterminated string');
      const quantityValue = this.input.substring(start, this.position);
      return this.createToken(TokenType.QUANTITY, quantityValue, start, this.position, startLine, startColumn);
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
    
    let hasTime = false;
    
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
    
    // Check for time part or T suffix
    if (this.current() === 'T') {
      hasTime = true;
      this.advance();
      // Check if there's actual time content after T
      if (this.isDigit(this.current())) {
        this.readTimeFormat();
      }
      // else: it's just a T suffix like @2020T or @2020-01T
    }
    
    // Optional timezone (only if we have time component with actual time values)
    if (hasTime && this.position > 0 && this.input[this.position - 1] !== 'T') {
      // Only read timezone if there's actual time content after T
      this.readTimezone();
    }
    
    const value = this.input.substring(start, this.position);
    
    // Determine token type based on content
    // DateTime: has 'T' anywhere
    // Date: no 'T' at all
    const tokenType = hasTime ? TokenType.DATETIME : TokenType.DATE;
    
    return this.createToken(tokenType, value, start, this.position, startLine, startColumn);
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
        // Only consume the period if it's followed by a digit
        // This prevents consuming periods that are method calls like .toDate()
        if (this.current() === '.' && this.position + 1 < this.input.length && 
            this.isDigit(this.input[this.position + 1]!)) {
          this.advance();
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

  // Operator utilities
  private static readonly OPERATORS: readonly string[] = [
    '!=', '!~', '<=', '>=',
    '+', '-', '*', '/', '<', '>', '=', '~', '|', '&',
  ];

  private isOperatorStarter(ch: string): boolean {
    switch (ch) {
      case '+':
      case '-':
      case '*':
      case '/':
      case '<':
      case '>':
      case '=':
      case '!':
      case '~':
      case '|':
      case '&':
        return true;
      default:
        return false;
    }
  }

  private readOperator(start: number, startLine: number, startColumn: number): Token {
    // Try longest-first
    for (const op of Lexer.OPERATORS) {
      const end = start + op.length;
      if (this.input.startsWith(op, start)) {
        // Advance to end and emit
        while (this.position < end) {
          this.advance();
        }
        return this.createToken(TokenType.OPERATOR, op, start, this.position, startLine, startColumn);
      }
    }
    // Special-case: lone '!'
    if (this.input[start] === '!') {
      // consume '!' to keep position consistent with old behavior before throwing?
      // Old code threw without consuming, but tests only assert message content.
      // Preserve position by not advancing.
      throw this.error(`Unexpected character '!' at position ${start}`);
    }
    // Fallback: treat as unexpected
    const ch = this.input[start] ?? '';
    throw this.error(`Unexpected character '${ch}' at position ${start}`);
  }

  // Generic quoted scanner used by strings, delimited identifiers, env vars, and quantity units
  private scanQuoted(quote: "'" | '"' | '`', unterminatedMessage: string): void {
    if (this.current() !== quote) {
      throw this.error('Internal error: scanQuoted called at non-quote');
    }
    // Skip opening quote
    this.advance();
    while (this.position < this.input.length) {
      const ch = this.current();
      if (ch === quote) {
        this.advance(); // Skip closing quote
        return;
      }
      if (ch === '\\') {
        this.advance();
        if (this.position >= this.input.length) {
          throw this.error(unterminatedMessage);
        }
        // Skip escaped character
        this.advance();
        continue;
      }
      this.advance();
    }
    throw this.error(unterminatedMessage);
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
        return;
      }
      this.advance();
    }
    
    // If we reached the end without finding */, it's an error
    throw this.error('Unclosed multi-line comment');
  }
  
  private advance(): void {
    if (this.position < this.input.length) {
      const char = this.input[this.position]!;
      
      if (this.options.trackPosition) {
        if (char === '\n') {
          this.line++;
          this.column = 1;
        } else if (char === '\r') {
          // Handle \r\n as single line ending
          if (this.position + 1 < this.input.length && this.input[this.position + 1] === '\n') {
            // Don't update line yet, wait for \n
          } else {
            // Standalone \r
            this.line++;
            this.column = 1;
          }
        } else {
          this.column++;
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

  // Identifier helpers (ASCII-based)
  private isIdentifierHead(code: number): boolean {
    return (code >= 65 && code <= 90) || // A-Z
           (code >= 97 && code <= 122) || // a-z
           code === 95; // _
  }

  private isIdentifierPart(code: number): boolean {
    return this.isIdentifierHead(code) || (code >= 48 && code <= 57); // 0-9
  }

  private scanIdentifierBody(): void {
    while (this.position < this.input.length) {
      const code = this.input.charCodeAt(this.position);
      if (this.isIdentifierPart(code)) {
        this.advance();
      } else {
        break;
      }
    }
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
    if (this.options.trackPosition) {
      const pos = this.offsetToPosition(this.position);
      const line = pos.line + 1; // present as 1-based
      const col = pos.character + 1; // present as 1-based
      return new Error(`Lexer error at ${line}:${col}: ${message}`);
    }
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
