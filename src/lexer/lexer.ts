import type { Token, Position } from './token';
import { TokenType, Channel } from './token';
import { CHAR_FLAGS, FLAG_DIGIT, FLAG_IDENTIFIER_START, FLAG_IDENTIFIER_CONT, FLAG_WHITESPACE } from './char-tables';
import { LexerError } from './errors';

// Token object pool to reduce allocations
class TokenPool {
  private pool: Token[] = [];
  private poolIndex: number = 0;
  
  getToken(type: TokenType, value: string, position: Position): Token {
    if (this.poolIndex < this.pool.length) {
      const token = this.pool[this.poolIndex++]!;
      token.type = type;
      token.value = value;
      token.position = position;
      token.channel = Channel.DEFAULT;
      return token;
    } else {
      const token = { type, value, position, channel: Channel.DEFAULT };
      this.pool.push(token);
      this.poolIndex++;
      return token;
    }
  }
  
  reset() {
    this.poolIndex = 0;
  }
}

export class FHIRPathLexer {
  private chars: string[];      // Character array for O(1) access
  private length: number;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokenPool = new TokenPool();
  
  // String interning for common tokens
  private readonly internedStrings = new Map<string, string>();
  
  // Keyword mapping
  private readonly KEYWORDS = new Map<string, TokenType>([
    ['true', TokenType.TRUE],
    ['false', TokenType.FALSE],
    ['div', TokenType.DIV],
    ['mod', TokenType.MOD],
    ['in', TokenType.IN],
    ['contains', TokenType.CONTAINS],
    ['and', TokenType.AND],
    ['or', TokenType.OR],
    ['xor', TokenType.XOR],
    ['implies', TokenType.IMPLIES],
    ['is', TokenType.IS],
    ['as', TokenType.AS],
    // Time units (dateTimePrecision)
    ['year', TokenType.UNIT],
    ['years', TokenType.UNIT],
    ['month', TokenType.UNIT],
    ['months', TokenType.UNIT],
    ['week', TokenType.UNIT],
    ['weeks', TokenType.UNIT],
    ['day', TokenType.UNIT],
    ['days', TokenType.UNIT],
    ['hour', TokenType.UNIT],
    ['hours', TokenType.UNIT],
    ['minute', TokenType.UNIT],
    ['minutes', TokenType.UNIT],
    ['second', TokenType.UNIT],
    ['seconds', TokenType.UNIT],
    ['millisecond', TokenType.UNIT],
    ['milliseconds', TokenType.UNIT],
  ]);
  
  constructor(input: string) {
    this.chars = Array.from(input);
    this.length = this.chars.length;
    
    // Pre-intern common strings
    const common = ['true', 'false', 'and', 'or', 'where', 'select', 'exists'];
    for (const str of common) {
      this.internedStrings.set(str, str);
    }
  }
  
  tokenize(): Token[] {
    const tokens: Token[] = [];
    this.tokenPool.reset();
    
    while (!this.isAtEnd()) {
      this.skipWhitespaceAndComments();
      if (this.isAtEnd()) break;
      
      const token = this.nextToken();
      if (token) {
        tokens.push(token);
      }
    }
    
    tokens.push(this.tokenPool.getToken(TokenType.EOF, '', this.getCurrentPosition()));
    return tokens;
  }
  
  private nextToken(): Token | null {
    const char = this.peek();
    const code = char.charCodeAt(0);
    
    // Fast path for ASCII characters using switch
    if (code < 128) {
      switch (code) {
        // Whitespace (should have been skipped, but just in case)
        case 32: case 9: case 10: case 13:
          this.advance();
          return null;
        
        // Single character tokens
        case 46: return this.makeTokenAndAdvance(TokenType.DOT, '.');       // .
        case 44: return this.makeTokenAndAdvance(TokenType.COMMA, ',');     // ,
        case 40: return this.makeTokenAndAdvance(TokenType.LPAREN, '(');    // (
        case 41: return this.makeTokenAndAdvance(TokenType.RPAREN, ')');    // )
        case 91: return this.makeTokenAndAdvance(TokenType.LBRACKET, '[');  // [
        case 93: return this.makeTokenAndAdvance(TokenType.RBRACKET, ']');  // ]
        case 43: return this.makeTokenAndAdvance(TokenType.PLUS, '+');      // +
        case 45: return this.makeTokenAndAdvance(TokenType.MINUS, '-');     // -
        case 42: return this.makeTokenAndAdvance(TokenType.STAR, '*');      // *
        case 47: return this.scanSlashOrComment();                          // /
        case 38: return this.makeTokenAndAdvance(TokenType.CONCAT, '&');    // &
        case 124: return this.makeTokenAndAdvance(TokenType.PIPE, '|');     // |
        case 61: return this.makeTokenAndAdvance(TokenType.EQ, '=');        // =
        case 126: return this.makeTokenAndAdvance(TokenType.EQUIV, '~');    // ~
        
        // Multi-character tokens
        case 60: return this.scanLessThan();      // < or <=
        case 62: return this.scanGreaterThan();   // > or >=
        case 33: return this.scanExclamation();   // != or !~
        
        // Complex tokens
        case 39: return this.scanString();                    // '
        case 96: return this.scanDelimitedIdentifier();       // `
        case 64: return this.scanDateTime();                  // @
        case 37: return this.scanEnvironmentVariable();       // %
        case 36: return this.scanSpecialVariable();           // $
        case 123: return this.scanNullLiteral();              // {
        
        default:
          // Use lookup table for classification
          if ((CHAR_FLAGS[code] & FLAG_DIGIT) !== 0) {
            return this.scanNumber();
          }
          if ((CHAR_FLAGS[code] & FLAG_IDENTIFIER_START) !== 0) {
            return this.scanIdentifierOrKeyword();
          }
      }
    }
    
    // Fallback for non-ASCII
    if (this.isIdentifierStart(char)) {
      return this.scanIdentifierOrKeyword();
    }
    
    throw this.error(`Unexpected character: ${char}`);
  }
  
  // Multi-character operator scanners
  private scanSlashOrComment(): Token | null {
    if (this.peekNext() === '/') {
      // Single-line comment - skip it
      this.skipWhitespaceAndComments();
      return null;
    } else if (this.peekNext() === '*') {
      // Multi-line comment - skip it
      this.skipWhitespaceAndComments();
      return null;
    } else {
      // Division operator
      return this.makeTokenAndAdvance(TokenType.SLASH, '/');
    }
  }
  
  private scanLessThan(): Token {
    const start = this.savePosition();
    this.advance(); // <
    
    if (this.peek() === '=') {
      this.advance(); // =
      return this.makeToken(TokenType.LTE, '<=', start);
    }
    
    return this.makeToken(TokenType.LT, '<', start);
  }
  
  private scanGreaterThan(): Token {
    const start = this.savePosition();
    this.advance(); // >
    
    if (this.peek() === '=') {
      this.advance(); // =
      return this.makeToken(TokenType.GTE, '>=', start);
    }
    
    return this.makeToken(TokenType.GT, '>', start);
  }
  
  private scanExclamation(): Token {
    const start = this.savePosition();
    this.advance(); // !
    
    if (this.peek() === '=') {
      this.advance(); // =
      return this.makeToken(TokenType.NEQ, '!=', start);
    } else if (this.peek() === '~') {
      this.advance(); // ~
      return this.makeToken(TokenType.NEQUIV, '!~', start);
    }
    
    throw this.error('Expected "=" or "~" after "!"');
  }
  
  // Fast character classification using lookup table
  private isDigit(char: string): boolean {
    const code = char.charCodeAt(0);
    return code < 128 && (CHAR_FLAGS[code]! & FLAG_DIGIT) !== 0;
  }
  
  private isIdentifierStart(char: string): boolean {
    const code = char.charCodeAt(0);
    if (code < 128) {
      return (CHAR_FLAGS[code]! & FLAG_IDENTIFIER_START) !== 0;
    }
    return this.isUnicodeIdentifierStart(char);
  }
  
  private isWhitespace(char: string): boolean {
    const code = char.charCodeAt(0);
    return code < 128 && (CHAR_FLAGS[code]! & FLAG_WHITESPACE) !== 0;
  }
  
  // O(1) character access
  private peek(offset: number = 0): string {
    const pos = this.position + offset;
    return pos < this.length ? this.chars[pos] : '\0';
  }
  
  // String interning for memory efficiency
  private intern(str: string): string {
    if (str.length <= 10) {
      const interned = this.internedStrings.get(str);
      if (interned) return interned;
      this.internedStrings.set(str, str);
    }
    return str;
  }
  
  // Helper Methods
  
  // Position and Character Navigation
  private savePosition(): Position {
    return {
      line: this.line,
      column: this.column,
      offset: this.position
    };
  }
  
  private getCurrentPosition(): Position {
    return this.savePosition();
  }
  
  private advance(): string {
    const char = this.chars[this.position++]!;
    
    // Update line/column for newlines
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    
    return char;
  }
  
  private isAtEnd(): boolean {
    return this.position >= this.length;
  }
  
  private peekNext(): string {
    return this.peek(1);
  }
  
  // Scanning Utilities
  private scanDigits(count?: number): string | null {
    const start = this.position;
    let scanned = 0;
    
    while (!this.isAtEnd() && this.isDigit(this.peek())) {
      this.advance();
      scanned++;
      if (count !== undefined && scanned >= count) break;
    }
    
    if (count !== undefined && scanned < count) {
      return null; // Didn't get required number of digits
    }
    
    return this.chars.slice(start, this.position).join('');
  }
  
  private scanIdentifier(): string {
    const start = this.position;
    
    while (!this.isAtEnd()) {
      const char = this.peek();
      const code = char.charCodeAt(0);
      
      if (code < 128) {
        if ((CHAR_FLAGS[code]! & FLAG_IDENTIFIER_CONT) === 0) break;
      } else {
        // Handle non-ASCII Unicode letters/digits
        if (!this.isUnicodeIdentifierCont(char)) break;
      }
      
      this.advance();
    }
    
    return this.chars.slice(start, this.position).join('');
  }
  
  private scanUntil(target: string): string {
    const start = this.position;
    
    while (!this.isAtEnd() && this.peek() !== target) {
      this.advance();
    }
    
    return this.chars.slice(start, this.position).join('');
  }
  
  private getTextFromPosition(start: Position): string {
    return this.chars.slice(start.offset, this.position).join('');
  }
  
  // Token Creation
  private makeToken(
    type: TokenType, 
    value: string, 
    start: Position, 
    channel: Channel = Channel.DEFAULT
  ): Token {
    const token = this.tokenPool.getToken(type, value, start);
    token.channel = channel;
    return token;
  }
  
  private makeTokenAndAdvance(type: TokenType, value: string): Token {
    const start = this.savePosition();
    this.advance();
    return this.makeToken(type, value, start);
  }
  
  // Complex Token Scanners
  
  private scanString(): Token {
    const start = this.savePosition();
    this.advance(); // consume opening '
    
    let value = '';
    while (!this.isAtEnd() && this.peek() !== "'") {
      if (this.peek() === '\\') {
        this.advance();
        value += this.scanEscapeSequence();
      } else {
        value += this.advance();
      }
    }
    
    if (this.isAtEnd()) {
      throw this.error('Unterminated string');
    }
    
    this.advance(); // consume closing '
    return this.makeToken(TokenType.STRING, value, start);
  }
  
  private scanEscapeSequence(): string {
    const char = this.advance();
    switch (char) {
      case '`': return '`';
      case "'": return "'";
      case '\\': return '\\';
      case '/': return '/';
      case 'f': return '\f';
      case 'n': return '\n';
      case 'r': return '\r';
      case 't': return '\t';
      case 'u': return this.scanUnicodeEscape();
      default: throw this.error(`Invalid escape sequence: \\${char}`);
    }
  }
  
  private scanUnicodeEscape(): string {
    // \uXXXX - exactly 4 hex digits
    let code = 0;
    for (let i = 0; i < 4; i++) {
      const char = this.peek();
      const digit = this.hexDigitValue(char);
      if (digit === -1) {
        throw this.error(`Invalid unicode escape sequence: expected hex digit, got '${char}'`);
      }
      code = code * 16 + digit;
      this.advance();
    }
    return String.fromCharCode(code);
  }
  
  private hexDigitValue(char: string): number {
    const code = char.charCodeAt(0);
    if (code >= 48 && code <= 57) return code - 48;        // 0-9
    if (code >= 65 && code <= 70) return code - 65 + 10;   // A-F
    if (code >= 97 && code <= 102) return code - 97 + 10;  // a-f
    return -1;
  }
  
  // Special Variables
  private scanSpecialVariable(): Token {
    const start = this.savePosition();
    this.advance(); // consume $
    
    const name = this.scanIdentifier();
    
    if (name === 'this') {
      return this.makeToken(TokenType.THIS, '$this', start);
    } else if (name === 'index') {
      return this.makeToken(TokenType.INDEX, '$index', start);
    } else if (name === 'total') {
      return this.makeToken(TokenType.TOTAL, '$total', start);
    } else {
      throw this.error(`Invalid special variable: $${name}`);
    }
  }
  
  // Date/Time Literals
  private scanDateTime(): Token {
    const start = this.savePosition();
    this.advance(); // consume @
    
    // Check for time-only literal: @T14:30:00
    if (this.peek() === 'T') {
      this.advance(); // consume T
      const timeFormat = this.scanTimeFormat();
      if (!timeFormat) {
        throw this.error('Invalid time format: expected time after @T');
      }
      return this.makeToken(TokenType.TIME, '@T' + timeFormat, start);
    }
    
    // Date, DateTime, or partial date literal
    let value = '@';
    
    // Year is required
    const year = this.scanDigits(4);
    if (!year) throw this.error('Invalid date/time format: expected 4-digit year');
    value += year;
    
    // Month is optional
    if (this.peek() === '-') {
      value += this.advance(); // -
      const month = this.scanDigits(2);
      if (!month) throw this.error('Invalid month');
      value += month;
      
      // Day is optional if month is present
      if (this.peek() === '-') {
        value += this.advance(); // -
        const day = this.scanDigits(2);
        if (!day) throw this.error('Invalid day');
        value += day;
        
        // Time component is optional
        if (this.peek() === 'T') {
          value += this.advance(); // T
          const timeFormat = this.scanTimeFormat();
          if (timeFormat) {
            value += timeFormat;
          }
        }
      } else if (this.peek() === 'T') {
        // Month without day but with time (rare but allowed)
        value += this.advance(); // T
        const timeFormat = this.scanTimeFormat();
        if (timeFormat) {
          value += timeFormat;
        }
      }
    } else if (this.peek() === 'T') {
      // Year with time but no month/day (also rare but allowed)
      value += this.advance(); // T
      const timeFormat = this.scanTimeFormat();
      if (timeFormat) {
        value += timeFormat;
      }
    }
    
    // Timezone is optional
    if (this.peek() === 'Z' || this.peek() === '+' || this.peek() === '-') {
      value += this.scanTimezone();
    }
    
    // Determine token type based on content
    const tokenType = value.includes('T') ? TokenType.DATETIME : TokenType.DATE;
    return this.makeToken(tokenType, value, start);
  }
  
  private scanTimeFormat(): string {
    // TIMEFORMAT: [0-9][0-9] (':'[0-9][0-9] (':'[0-9][0-9] ('.'[0-9]+)?)?)?
    let time = '';
    
    // Hour is required
    const hour = this.scanDigits(2);
    if (!hour) return ''; // Empty time allowed in some contexts
    time += hour;
    
    // Minutes optional
    if (this.peek() === ':') {
      time += this.advance(); // :
      const minute = this.scanDigits(2);
      if (!minute) throw this.error('Invalid time format: expected 2-digit minute');
      time += minute;
      
      // Seconds optional
      if (this.peek() === ':') {
        time += this.advance(); // :
        const second = this.scanDigits(2);
        if (!second) throw this.error('Invalid time format: expected 2-digit second');
        time += second;
        
        // Fractional seconds optional
        if (this.peek() === '.') {
          time += this.advance(); // .
          const fraction = this.scanDigits();
          if (!fraction) throw this.error('Invalid time format: expected fractional seconds');
          time += fraction;
        }
      }
    }
    
    return time;
  }
  
  private scanTimezone(): string {
    const char = this.peek();
    
    if (char === 'Z') {
      this.advance();
      return 'Z';
    }
    
    if (char === '+' || char === '-') {
      let tz = this.advance(); // + or -
      const hour = this.scanDigits(2);
      if (!hour) throw this.error('Invalid timezone: expected 2-digit hour');
      tz += hour;
      
      if (this.peek() !== ':') {
        throw this.error('Invalid timezone: expected ":" after hour');
      }
      tz += this.advance(); // :
      
      const minute = this.scanDigits(2);
      if (!minute) throw this.error('Invalid timezone: expected 2-digit minute');
      tz += minute;
      
      return tz;
    }
    
    return '';
  }
  
  // Number Literals
  private scanNumber(): Token {
    const start = this.savePosition();
    
    // Allow leading zeros (e.g., 0123)
    while (this.isDigit(this.peek())) {
      this.advance();
    }
    
    // Check for decimal point
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      this.advance(); // consume .
      while (this.isDigit(this.peek())) {
        this.advance();
      }
    }
    
    const value = this.getTextFromPosition(start);
    return this.makeToken(TokenType.NUMBER, value, start);
  }
  
  // Null Literal
  private scanNullLiteral(): Token {
    const start = this.savePosition();
    this.advance(); // consume {
    
    if (this.peek() !== '}') {
      throw this.error('Expected "}" for null literal');
    }
    
    this.advance(); // consume }
    return this.makeToken(TokenType.NULL, '{}', start);
  }
  
  // Delimited Identifiers
  private scanDelimitedIdentifier(): Token {
    const start = this.savePosition();
    this.advance(); // consume opening `
    
    let value = '';
    while (!this.isAtEnd() && this.peek() !== '`') {
      if (this.peek() === '\\') {
        this.advance();
        value += this.scanEscapeSequence();
      } else {
        value += this.advance();
      }
    }
    
    if (this.isAtEnd()) {
      throw this.error('Unterminated delimited identifier');
    }
    
    this.advance(); // consume closing `
    return this.makeToken(TokenType.DELIMITED_IDENTIFIER, value, start);
  }
  
  // Environment Variables
  private scanEnvironmentVariable(): Token {
    const start = this.savePosition();
    this.advance(); // consume %
    
    let name: string;
    if (this.peek() === '`') {
      // Delimited: %`vs-name`
      this.advance(); // consume `
      name = this.scanUntil('`');
      this.advance(); // consume closing `
    } else if (this.peek() === "'") {
      // String form: %'string value'
      const stringToken = this.scanString();
      name = stringToken.value;
    } else {
      // Simple: %context
      name = this.scanIdentifier();
    }
    
    return this.makeToken(TokenType.ENV_VAR, name, start);
  }
  
  // Identifiers and Keywords
  private scanIdentifierOrKeyword(): Token {
    const start = this.savePosition();
    const value = this.scanIdentifier();
    
    // Intern the string for efficient comparison
    const internedValue = this.intern(value);
    
    // Check if it's a keyword
    const keywordType = this.KEYWORDS.get(internedValue);
    if (keywordType) {
      return this.tokenPool.getToken(keywordType, internedValue, start);
    }
    
    return this.tokenPool.getToken(TokenType.IDENTIFIER, internedValue, start);
  }
  
  // Unicode Support
  private isUnicodeIdentifierStart(char: string): boolean {
    // Unicode categories: Letter (L*), Letter Number (Nl)
    return /\p{L}|\p{Nl}/u.test(char);
  }
  
  private isUnicodeIdentifierCont(char: string): boolean {
    // Unicode categories: Letter (L*), Number (N*), Mark (M*), Connector Punctuation (Pc)
    return /\p{L}|\p{N}|\p{M}|\p{Pc}/u.test(char);
  }
  
  // Comment and Whitespace Handling
  private skipWhitespaceAndComments(preserveTrivia: boolean = false): Token[] {
    const trivia: Token[] = [];
    
    while (!this.isAtEnd()) {
      const start = this.savePosition();
      const char = this.peek();
      
      if (this.isWhitespace(char)) {
        const ws = this.scanWhitespace();
        if (preserveTrivia) {
          trivia.push(this.makeToken(TokenType.WS, ws, start, Channel.HIDDEN));
        }
      } else if (char === '/' && this.peekNext() === '/') {
        // Single-line comment
        this.advance(); // /
        this.advance(); // /
        const comment = '//' + this.scanUntil('\n');
        if (preserveTrivia) {
          trivia.push(this.makeToken(TokenType.LINE_COMMENT, comment, start, Channel.HIDDEN));
        }
      } else if (char === '/' && this.peekNext() === '*') {
        // Multi-line comment
        this.advance(); // /
        this.advance(); // *
        let comment = '/*';
        while (!this.isAtEnd() && !(this.peek() === '*' && this.peekNext() === '/')) {
          comment += this.advance();
        }
        if (!this.isAtEnd()) {
          comment += this.advance(); // *
          comment += this.advance(); // /
        }
        if (preserveTrivia) {
          trivia.push(this.makeToken(TokenType.COMMENT, comment, start, Channel.HIDDEN));
        }
      } else {
        break;
      }
    }
    
    return trivia;
  }
  
  private scanWhitespace(): string {
    const start = this.position;
    while (!this.isAtEnd() && this.isWhitespace(this.peek())) {
      this.advance();
    }
    return this.chars.slice(start, this.position).join('');
  }
  
  // Error handling
  private error(message: string): LexerError {
    return new LexerError(
      message,
      this.getCurrentPosition(),
      this.peek()
    );
  }
}

// Export convenience function
export function lex(input: string): Token[] {
  const lexer = new FHIRPathLexer(input);
  return lexer.tokenize();
}