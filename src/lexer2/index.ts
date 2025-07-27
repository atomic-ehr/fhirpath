export enum TokenType {
  // Literals
  NULL = 'NULL',
  BOOLEAN = 'BOOLEAN',
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  DATETIME = 'DATETIME',
  TIME = 'TIME',
  
  // Identifiers
  IDENTIFIER = 'IDENTIFIER',
  DELIMITED_IDENTIFIER = 'DELIMITED_IDENTIFIER',
  
  // Keywords
  TRUE = 'TRUE',
  FALSE = 'FALSE',
  AS = 'AS',
  CONTAINS = 'CONTAINS',
  IN = 'IN',
  IS = 'IS',
  DIV = 'DIV',
  MOD = 'MOD',
  AND = 'AND',
  OR = 'OR',
  XOR = 'XOR',
  IMPLIES = 'IMPLIES',
  
  // Special identifiers
  THIS = 'THIS',
  INDEX = 'INDEX',
  TOTAL = 'TOTAL',
  
  // Operators
  DOT = 'DOT',
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',
  LBRACE = 'LBRACE',
  RBRACE = 'RBRACE',
  PLUS = 'PLUS',
  MINUS = 'MINUS',
  MULTIPLY = 'MULTIPLY',
  DIVIDE = 'DIVIDE',
  AMPERSAND = 'AMPERSAND',
  PIPE = 'PIPE',
  LTE = 'LTE',
  LT = 'LT',
  GT = 'GT',
  GTE = 'GTE',
  EQ = 'EQ',
  NEQ = 'NEQ',
  SIMILAR = 'SIMILAR',
  NOT_SIMILAR = 'NOT_SIMILAR',
  COMMA = 'COMMA',
  PERCENT = 'PERCENT',
  AT = 'AT',
  
  // Date/time units
  YEAR = 'YEAR',
  MONTH = 'MONTH',
  WEEK = 'WEEK',
  DAY = 'DAY',
  HOUR = 'HOUR',
  MINUTE = 'MINUTE',
  SECOND = 'SECOND',
  MILLISECOND = 'MILLISECOND',
  YEARS = 'YEARS',
  MONTHS = 'MONTHS',
  WEEKS = 'WEEKS',
  DAYS = 'DAYS',
  HOURS = 'HOURS',
  MINUTES = 'MINUTES',
  SECONDS = 'SECONDS',
  MILLISECONDS = 'MILLISECONDS',
  
  // Special
  EOF = 'EOF',
  WHITESPACE = 'WHITESPACE',
  COMMENT = 'COMMENT',
  LINE_COMMENT = 'LINE_COMMENT',
}

export interface Token {
  type: TokenType;
  start: number;
  end: number;
  line: number;
  column: number;
}

export interface LexerOptions {
  skipWhitespace?: boolean;
  skipComments?: boolean;
}

// Character code constants
const CHAR_0 = 48;
const CHAR_9 = 57;
const CHAR_A = 65;
const CHAR_F = 70;
const CHAR_Z = 90;
const CHAR_UNDERSCORE = 95;
const CHAR_a = 97;
const CHAR_f = 102;
const CHAR_z = 122;

// Lookup tables for character classification
const IS_DIGIT = new Uint8Array(256);
const IS_LETTER = new Uint8Array(256);
const IS_LETTER_OR_DIGIT = new Uint8Array(256);
const IS_HEX_DIGIT = new Uint8Array(256);

// Initialize lookup tables
for (let i = 0; i < 256; i++) {
  if (i >= CHAR_0 && i <= CHAR_9) {
    IS_DIGIT[i] = 1;
    IS_LETTER_OR_DIGIT[i] = 1;
    IS_HEX_DIGIT[i] = 1;
  }
  if ((i >= CHAR_A && i <= CHAR_Z) || (i >= CHAR_a && i <= CHAR_z) || i === CHAR_UNDERSCORE) {
    IS_LETTER[i] = 1;
    IS_LETTER_OR_DIGIT[i] = 1;
  }
  if ((i >= CHAR_A && i <= CHAR_F) || (i >= CHAR_a && i <= CHAR_f)) {
    IS_HEX_DIGIT[i] = 1;
  }
}

export class Lexer {
  private input: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private options: LexerOptions;
  
  constructor(input: string, options: LexerOptions = {}) {
    this.input = input;
    this.options = {
      skipWhitespace: options.skipWhitespace ?? true,
      skipComments: options.skipComments ?? true,
    };
  }
    
  private peek(offset: number = 0): string {
    const pos = this.position + offset;
    if (pos >= this.input.length) {
      return '';
    }
    return this.input[pos] || '';
  }
  
  private peekCharCode(offset: number = 0): number {
    const pos = this.position + offset;
    if (pos >= this.input.length) {
      return -1;
    }
    return this.input.charCodeAt(pos);
  }
  
  
  private throwUnexpectedChar(char: string): never {
    throw new Error(`Unexpected character '${char}' at position ${this.position}`);
  }
  
  private advance(): string {
    if (this.position >= this.input.length) {
      return '';
    }
    const char = this.input[this.position] || '';
    this.position++;
    
    // Update line and column
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    
    return char;
  }
  
  private readWhitespace(): Token | null {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    // Inline whitespace reading with character code switch
    while (this.position < this.input.length) {
      const charCode = this.input.charCodeAt(this.position);
      
      switch (charCode) {
        case 32:  // ' ' (space)
        case 9:   // '\t' (tab)
          this.position++;
          this.column++;
          break;
        case 13:  // '\r' (carriage return)
          this.position++;
          // Don't update column for \r
          break;
        case 10:  // '\n' (line feed)
          this.position++;
          this.line++;
          this.column = 1;
          break;
        default:
          // Not whitespace, exit loop
          if (this.position > start) {
            return { type: TokenType.WHITESPACE, start, end: this.position, line: startLine, column: startColumn };
          }
          return null;
      }
    }
    
    // Reached end of input
    if (this.position > start) {
      return { type: TokenType.WHITESPACE, start, end: this.position, line: startLine, column: startColumn };
    }
    
    return null;
  }
  
  private readComment(): Token | null {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    if (this.peek() === '/' && this.peek(1) === '*') {
      this.advance(); // /
      this.advance(); // *
      
      while (this.position < this.input.length - 1) {
        if (this.peek() === '*' && this.peek(1) === '/') {
          this.advance(); // *
          this.advance(); // /
          break;
        }
        this.advance();
      }
      
      return { type: TokenType.COMMENT, start, end: this.position, line: startLine, column: startColumn };
    }
    
    if (this.peek() === '/' && this.peek(1) === '/') {
      this.advance(); // /
      this.advance(); // /
      
      while (this.position < this.input.length && this.peek() !== '\n') {
        this.advance();
      }
      
      return { type: TokenType.LINE_COMMENT, start, end: this.position, line: startLine, column: startColumn };
    }
    
    return null;
  }
  
  private readString(): Token | null {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;    
    if (this.peek() !== "'") {
      return null;
    }
    
    this.advance(); // '
    
    while (this.position < this.input.length) {
      const char = this.peek();
      
      if (char === "'") {
        this.advance();
        return { type: TokenType.STRING, start, end: this.position, line: startLine, column: startColumn };
      }
      
      if (char === '\\') {
        this.advance();
        const escaped = this.peek();
        switch (escaped) {
          case '`':
          case "'":
          case '\\':
          case '/':
          case 'f':
          case 'n':
          case 'r':
          case 't':
            this.advance();
            break;
          case 'u':
            this.advance();
            for (let i = 0; i < 4; i++) {
              const hexCode = this.peekCharCode();
              if (hexCode >= 0 && hexCode < 256 && IS_HEX_DIGIT[hexCode]) {
                this.advance();
              } else {
                throw new Error(`Invalid unicode escape at position ${this.position}`);
              }
            }
            break;
          default:
            throw new Error(`Invalid escape sequence \\${escaped} at position ${this.position}`);
        }
      } else {
        this.advance();
      }
    }
    
    throw new Error(`Unterminated string at position ${start}`);
  }
  
  private readDelimitedIdentifier(): Token | null {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;    
    if (this.peek() !== '`') {
      return null;
    }
    
    this.advance(); // `
    
    while (this.position < this.input.length) {
      const char = this.peek();
      
      if (char === '`') {
        this.advance();
        return { type: TokenType.DELIMITED_IDENTIFIER, start, end: this.position, line: startLine, column: startColumn };
      }
      
      if (char === '\\') {
        this.advance();
        const escaped = this.peek();
        if (escaped === '`' || escaped === '\\') {
          this.advance();
        }
      } else {
        this.advance();
      }
    }
    
    throw new Error(`Unterminated delimited identifier at position ${start}`);
  }
  
  private readNumber(): Token | null {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    // Inline first digit check
    if (this.position >= this.input.length) return null;
    const firstCharCode = this.input.charCodeAt(this.position);
    if (!IS_DIGIT[firstCharCode]) {
      return null;
    }
    
    // Inline digit reading loop
    while (this.position < this.input.length) {
      const charCode = this.input.charCodeAt(this.position);
      if (IS_DIGIT[charCode]) {
        this.position++;
      } else {
        break;
      }
    }
    
    // Check for decimal part
    if (this.position < this.input.length && this.input[this.position] === '.') {
      const nextPos = this.position + 1;
      if (nextPos < this.input.length) {
        const nextCharCode = this.input.charCodeAt(nextPos);
        if (IS_DIGIT[nextCharCode]) {
          this.position++; // consume '.'
          // Inline decimal digit reading
          while (this.position < this.input.length) {
            const charCode = this.input.charCodeAt(this.position);
            if (IS_DIGIT[charCode]) {
              this.position++;
            } else {
              break;
            }
          }
        }
      }
    }
    
    return { type: TokenType.NUMBER, start, end: this.position, line: startLine, column: startColumn };
  }
  
  private readDateTime(): Token | null {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;    
    if (this.peek() !== '@') {
      return null;
    }
    
    const savedPosition = this.position;
    const savedLine = this.line;
    const savedColumn = this.column;
    this.advance(); // @
    
    // Check for time format first
    if (this.peek() === 'T') {
      this.advance(); // T
      if (this.readTimeFormat()) {
        return { type: TokenType.TIME, start, end: this.position, line: startLine, column: startColumn };
      }
      // Restore position if not a valid time
      this.position = savedPosition;
      this.line = savedLine;
      this.column = savedColumn;
      return null;
    }
    
    // Try to read datetime
    // Year (4 digits)
    for (let i = 0; i < 4; i++) {
      const charCode = this.peekCharCode();
      if (charCode < 0 || charCode >= 256 || !IS_DIGIT[charCode]) {
        this.position = savedPosition;
      this.line = savedLine;
      this.column = savedColumn;
        return null;
      }
      this.advance();
    }
    
    // Optional month, day, time
    if (this.peek() === '-') {
      this.advance();
      // Month
      const monthChar0 = this.peekCharCode();
      const monthChar1 = this.peekCharCode(1);
      if (monthChar0 < 0 || monthChar0 >= 256 || !IS_DIGIT[monthChar0] || 
          monthChar1 < 0 || monthChar1 >= 256 || !IS_DIGIT[monthChar1]) {
        this.position = savedPosition;
      this.line = savedLine;
      this.column = savedColumn;
        return null;
      }
      this.advance();
      this.advance();
      
      // Optional day
      if (this.peek() === '-') {
        this.advance();
        const dayChar0 = this.peekCharCode();
        const dayChar1 = this.peekCharCode(1);
        if (dayChar0 < 0 || dayChar0 >= 256 || !IS_DIGIT[dayChar0] || 
            dayChar1 < 0 || dayChar1 >= 256 || !IS_DIGIT[dayChar1]) {
          this.position = savedPosition;
      this.line = savedLine;
      this.column = savedColumn;
          return null;
        }
        this.advance();
        this.advance();
        
        // Optional time
        if (this.peek() === 'T') {
          this.advance();
          this.readTimeFormat();
        }
      } else if (this.peek() === 'T') {
        this.advance();
      }
    } else if (this.peek() === 'T') {
      this.advance();
    }
    
    // Optional timezone
    if (this.peek() === 'Z') {
      this.advance();
    } else if (this.peek() === '+' || this.peek() === '-') {
      this.advance();
      const tzChar0 = this.peekCharCode();
      const tzChar1 = this.peekCharCode(1);
      if (tzChar0 < 0 || tzChar0 >= 256 || !IS_DIGIT[tzChar0] || 
          tzChar1 < 0 || tzChar1 >= 256 || !IS_DIGIT[tzChar1]) {
        // Invalid timezone offset
      } else {
        this.advance();
        this.advance();
        if (this.peek() === ':') {
          this.advance();
          const tzMinChar0 = this.peekCharCode();
          const tzMinChar1 = this.peekCharCode(1);
          if (tzMinChar0 >= 0 && tzMinChar0 < 256 && IS_DIGIT[tzMinChar0] && 
              tzMinChar1 >= 0 && tzMinChar1 < 256 && IS_DIGIT[tzMinChar1]) {
            this.advance();
            this.advance();
          }
        }
      }
    }
    
    return { type: TokenType.DATETIME, start, end: this.position, line: startLine, column: startColumn };
  }
  
  private readTimeFormat(): boolean {
    // HH
    const hhChar0 = this.peekCharCode();
    const hhChar1 = this.peekCharCode(1);
    if (hhChar0 < 0 || hhChar0 >= 256 || !IS_DIGIT[hhChar0] || 
        hhChar1 < 0 || hhChar1 >= 256 || !IS_DIGIT[hhChar1]) {
      return false;
    }
    this.advance();
    this.advance();
    
    // Optional :MM
    if (this.peek() === ':') {
      this.advance();
      const mmChar0 = this.peekCharCode();
      const mmChar1 = this.peekCharCode(1);
      if (mmChar0 < 0 || mmChar0 >= 256 || !IS_DIGIT[mmChar0] || 
          mmChar1 < 0 || mmChar1 >= 256 || !IS_DIGIT[mmChar1]) {
        return false;
      }
      this.advance();
      this.advance();
      
      // Optional :SS
      if (this.peek() === ':') {
        this.advance();
        const ssChar0 = this.peekCharCode();
        const ssChar1 = this.peekCharCode(1);
        if (ssChar0 < 0 || ssChar0 >= 256 || !IS_DIGIT[ssChar0] || 
            ssChar1 < 0 || ssChar1 >= 256 || !IS_DIGIT[ssChar1]) {
          return false;
        }
        this.advance();
        this.advance();
        
        // Optional .fraction
        if (this.peek() === '.') {
          this.advance();
          const fracChar = this.peekCharCode();
          if (fracChar < 0 || fracChar >= 256 || !IS_DIGIT[fracChar]) {
            return false;
          }
          while (this.position < this.input.length) {
            const charCode = this.peekCharCode();
            if (charCode >= 0 && charCode < 256 && IS_DIGIT[charCode]) {
              this.advance();
            } else {
              break;
            }
          }
        }
      }
    }
    
    return true;
  }
  
  private readIdentifierOrKeyword(): Token | null {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    // Inline first letter check
    if (this.position >= this.input.length) return null;
    const firstCharCode = this.input.charCodeAt(this.position);
    if (!IS_LETTER[firstCharCode]) {
      return null;
    }
    
    // Inline letter/digit reading loop
    while (this.position < this.input.length) {
      const charCode = this.input.charCodeAt(this.position);
      if (IS_LETTER_OR_DIGIT[charCode]) {
        this.position++;
      } else {
        break;
      }
    }
    
    const length = this.position - start;
    const value = this.input.substring(start, this.position);
    
    // Check for keywords based on length
    let type: TokenType = TokenType.IDENTIFIER;
    
    switch (length) {
      case 2:
        switch (value) {
          case 'as': type = TokenType.AS; break;
          case 'in': type = TokenType.IN; break;
          case 'is': type = TokenType.IS; break;
          case 'or': type = TokenType.OR; break;
        }
        break;
      case 3:
        switch (value) {
          case 'div': type = TokenType.DIV; break;
          case 'mod': type = TokenType.MOD; break;
          case 'and': type = TokenType.AND; break;
          case 'xor': type = TokenType.XOR; break;
          case 'day': type = TokenType.DAY; break;
        }
        break;
      case 4:
        switch (value) {
          case 'true': type = TokenType.TRUE; break;
          case 'year': type = TokenType.YEAR; break;
          case 'week': type = TokenType.WEEK; break;
          case 'hour': type = TokenType.HOUR; break;
          case 'days': type = TokenType.DAYS; break;
        }
        break;
      case 5:
        switch (value) {
          case 'false': type = TokenType.FALSE; break;
          case 'month': type = TokenType.MONTH; break;
          case 'weeks': type = TokenType.WEEKS; break;
          case 'years': type = TokenType.YEARS; break;
          case 'hours': type = TokenType.HOURS; break;
        }
        break;
      case 6:
        switch (value) {
          case 'minute': type = TokenType.MINUTE; break;
          case 'second': type = TokenType.SECOND; break;
          case 'months': type = TokenType.MONTHS; break;
        }
        break;
      case 7:
        switch (value) {
          case 'implies': type = TokenType.IMPLIES; break;
          case 'minutes': type = TokenType.MINUTES; break;
          case 'seconds': type = TokenType.SECONDS; break;
        }
        break;
      case 8:
        if (value === 'contains') type = TokenType.CONTAINS;
        break;
      case 11:
        if (value === 'millisecond') type = TokenType.MILLISECOND;
        break;
      case 12:
        if (value === 'milliseconds') type = TokenType.MILLISECONDS;
        break;
    }
    
    return { type, start, end: this.position, line: startLine, column: startColumn };
  }
  
  private readSpecialIdentifier(): Token | null {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;    
    if (this.peek() !== '$') {
      return null;
    }
    
    const ahead = this.input.substring(this.position, this.position + 6);
    
    if (ahead.startsWith('$this')) {
      this.position += 5;
      this.column += 5;
      return { type: TokenType.THIS, start, end: this.position, line: startLine, column: startColumn };
    }
    
    if (ahead.startsWith('$index')) {
      this.position += 6;
      this.column += 6;
      return { type: TokenType.INDEX, start, end: this.position, line: startLine, column: startColumn };
    }
    
    if (ahead.startsWith('$total')) {
      this.position += 6;
      this.column += 6;
      return { type: TokenType.TOTAL, start, end: this.position, line: startLine, column: startColumn };
    }
    
    return null;
  }
  
  public nextToken(): Token {
    // Skip whitespace and comments
    while (this.position < this.input.length) {
      const wsToken = this.readWhitespace();
      if (wsToken) {
        if (!this.options.skipWhitespace) return wsToken;
        continue;
      }
      
      const commentToken = this.readComment();
      if (commentToken) {
        if (!this.options.skipComments) return commentToken;
        continue;
      }
      
      break;
    }
    
    if (this.position >= this.input.length) {
      return { type: TokenType.EOF, start: this.position, end: this.position, line: this.line, column: this.column };
    }
    
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    const firstChar = this.peek();
    const firstCharCode = this.peekCharCode();
    
    // Switch on first character for faster dispatch
    switch (firstChar) {
      // String literal
      case "'":
        return this.readString() || this.throwUnexpectedChar(firstChar);
        
      // Delimited identifier
      case '`':
        return this.readDelimitedIdentifier() || this.throwUnexpectedChar(firstChar);
        
      // DateTime/Time or AT operator
      case '@':
        const dt = this.readDateTime();
        if (dt) return dt;
        // If not datetime, it's AT operator
        this.advance();
        return { type: TokenType.AT, start, end: this.position, line: startLine, column: startColumn };
        
      // Special identifiers
      case '$':
        return this.readSpecialIdentifier() || this.throwUnexpectedChar(firstChar);
        
      // External constant
      case '%':
        this.advance();
        return { type: TokenType.PERCENT, start, end: this.position, line: startLine, column: startColumn };
        
      // Single-character operators
      case '.':
        this.advance();
        return { type: TokenType.DOT, start, end: this.position, line: startLine, column: startColumn };
      case '(':
        this.advance();
        return { type: TokenType.LPAREN, start, end: this.position, line: startLine, column: startColumn };
      case ')':
        this.advance();
        return { type: TokenType.RPAREN, start, end: this.position, line: startLine, column: startColumn };
      case '[':
        this.advance();
        return { type: TokenType.LBRACKET, start, end: this.position, line: startLine, column: startColumn };
      case ']':
        this.advance();
        return { type: TokenType.RBRACKET, start, end: this.position, line: startLine, column: startColumn };
      case '{':
        this.advance();
        return { type: TokenType.LBRACE, start, end: this.position, line: startLine, column: startColumn };
      case '}':
        this.advance();
        return { type: TokenType.RBRACE, start, end: this.position, line: startLine, column: startColumn };
      case '+':
        this.advance();
        return { type: TokenType.PLUS, start, end: this.position, line: startLine, column: startColumn };
      case '-':
        this.advance();
        return { type: TokenType.MINUS, start, end: this.position, line: startLine, column: startColumn };
      case '*':
        this.advance();
        return { type: TokenType.MULTIPLY, start, end: this.position, line: startLine, column: startColumn };
      case '/':
        this.advance();
        return { type: TokenType.DIVIDE, start, end: this.position, line: startLine, column: startColumn };
      case '&':
        this.advance();
        return { type: TokenType.AMPERSAND, start, end: this.position, line: startLine, column: startColumn };
      case '|':
        this.advance();
        return { type: TokenType.PIPE, start, end: this.position, line: startLine, column: startColumn };
      case '~':
        this.advance();
        return { type: TokenType.SIMILAR, start, end: this.position, line: startLine, column: startColumn };
      case ',':
        this.advance();
        return { type: TokenType.COMMA, start, end: this.position, line: startLine, column: startColumn };
      case '=':
        this.advance();
        return { type: TokenType.EQ, start, end: this.position, line: startLine, column: startColumn };
        
      // Two-character operators starting with <
      case '<':
        this.advance();
        if (this.peek() === '=') {
          this.advance();
          return { type: TokenType.LTE, start, end: this.position, line: startLine, column: startColumn };
        }
        return { type: TokenType.LT, start, end: this.position, line: startLine, column: startColumn };
        
      // Two-character operators starting with >
      case '>':
        this.advance();
        if (this.peek() === '=') {
          this.advance();
          return { type: TokenType.GTE, start, end: this.position, line: startLine, column: startColumn };
        }
        return { type: TokenType.GT, start, end: this.position, line: startLine, column: startColumn };
        
      // Two-character operators starting with !
      case '!':
        this.advance();
        const nextChar = this.peek();
        if (nextChar === '=') {
          this.advance();
          return { type: TokenType.NEQ, start, end: this.position, line: startLine, column: startColumn };
        } else if (nextChar === '~') {
          this.advance();
          return { type: TokenType.NOT_SIMILAR, start, end: this.position, line: startLine, column: startColumn };
        }
        throw new Error(`Unexpected character '${firstChar}' at position ${this.position - 1}`);
        
      default:
        // Inline digit check
        if (firstCharCode < 256 && IS_DIGIT[firstCharCode]) {
          return this.readNumber() || this.throwUnexpectedChar(firstChar);
        }
        
        // Inline letter check
        if (firstCharCode < 256 && IS_LETTER[firstCharCode]) {
          return this.readIdentifierOrKeyword() || this.throwUnexpectedChar(firstChar);
        }
        
        // Unknown character
        throw new Error(`Unexpected character '${firstChar}' at position ${this.position}`);
    }
  }
  
  public tokenize(): Token[] {
    const tokens: Token[] = [];
    
    while (true) {
      const token = this.nextToken();
      tokens.push(token);
      if (token.type === TokenType.EOF) {
        break;
      }
    }
    
    return tokens;
  }
  
  public getTokenValue(token: Token): string {
    return this.input.substring(token.start, token.end);
  }
}