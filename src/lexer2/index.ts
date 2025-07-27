export enum TokenType {
  // Literals
  NULL,
  BOOLEAN,
  STRING,
  NUMBER,
  DATETIME,
  TIME,
  
  // Identifiers
  IDENTIFIER,
  DELIMITED_IDENTIFIER,
  
  // Keywords
  TRUE,
  FALSE,
  AS,
  CONTAINS,
  IN,
  IS,
  DIV,
  MOD,
  AND,
  OR,
  XOR,
  IMPLIES,
  
  // Special identifiers
  THIS,
  INDEX,
  TOTAL,
  
  // Operators
  DOT,
  LPAREN,
  RPAREN,
  LBRACKET,
  RBRACKET,
  LBRACE,
  RBRACE,
  PLUS,
  MINUS,
  MULTIPLY,
  DIVIDE,
  AMPERSAND,
  PIPE,
  LTE,
  LT,
  GT,
  GTE,
  EQ,
  NEQ,
  SIMILAR,
  NOT_SIMILAR,
  COMMA,
  PERCENT,
  AT,
  
  // Environment variable
  ENV_VAR,
  
  // Date/time units
  YEAR,
  MONTH,
  WEEK,
  DAY,
  HOUR,
  MINUTE,
  SECOND,
  MILLISECOND,
  YEARS,
  MONTHS,
  WEEKS,
  DAYS,
  HOURS,
  MINUTES,
  SECONDS,
  MILLISECONDS,
  
  // Special
  EOF,
  WHITESPACE,
  COMMENT,
  LINE_COMMENT,
}

// Helper to convert numeric token type to string for debugging
const TOKEN_TYPE_NAMES: { [key: number]: string } = {
  [TokenType.NULL]: 'NULL',
  [TokenType.BOOLEAN]: 'BOOLEAN',
  [TokenType.STRING]: 'STRING',
  [TokenType.NUMBER]: 'NUMBER',
  [TokenType.DATETIME]: 'DATETIME',
  [TokenType.TIME]: 'TIME',
  [TokenType.IDENTIFIER]: 'IDENTIFIER',
  [TokenType.DELIMITED_IDENTIFIER]: 'DELIMITED_IDENTIFIER',
  [TokenType.TRUE]: 'TRUE',
  [TokenType.FALSE]: 'FALSE',
  [TokenType.AS]: 'AS',
  [TokenType.CONTAINS]: 'CONTAINS',
  [TokenType.IN]: 'IN',
  [TokenType.IS]: 'IS',
  [TokenType.DIV]: 'DIV',
  [TokenType.MOD]: 'MOD',
  [TokenType.AND]: 'AND',
  [TokenType.OR]: 'OR',
  [TokenType.XOR]: 'XOR',
  [TokenType.IMPLIES]: 'IMPLIES',
  [TokenType.THIS]: 'THIS',
  [TokenType.INDEX]: 'INDEX',
  [TokenType.TOTAL]: 'TOTAL',
  [TokenType.DOT]: 'DOT',
  [TokenType.LPAREN]: 'LPAREN',
  [TokenType.RPAREN]: 'RPAREN',
  [TokenType.LBRACKET]: 'LBRACKET',
  [TokenType.RBRACKET]: 'RBRACKET',
  [TokenType.LBRACE]: 'LBRACE',
  [TokenType.RBRACE]: 'RBRACE',
  [TokenType.PLUS]: 'PLUS',
  [TokenType.MINUS]: 'MINUS',
  [TokenType.MULTIPLY]: 'MULTIPLY',
  [TokenType.DIVIDE]: 'DIVIDE',
  [TokenType.AMPERSAND]: 'AMPERSAND',
  [TokenType.PIPE]: 'PIPE',
  [TokenType.LTE]: 'LTE',
  [TokenType.LT]: 'LT',
  [TokenType.GT]: 'GT',
  [TokenType.GTE]: 'GTE',
  [TokenType.EQ]: 'EQ',
  [TokenType.NEQ]: 'NEQ',
  [TokenType.SIMILAR]: 'SIMILAR',
  [TokenType.NOT_SIMILAR]: 'NOT_SIMILAR',
  [TokenType.COMMA]: 'COMMA',
  [TokenType.PERCENT]: 'PERCENT',
  [TokenType.AT]: 'AT',
  [TokenType.ENV_VAR]: 'ENV_VAR',
  [TokenType.YEAR]: 'YEAR',
  [TokenType.MONTH]: 'MONTH',
  [TokenType.WEEK]: 'WEEK',
  [TokenType.DAY]: 'DAY',
  [TokenType.HOUR]: 'HOUR',
  [TokenType.MINUTE]: 'MINUTE',
  [TokenType.SECOND]: 'SECOND',
  [TokenType.MILLISECOND]: 'MILLISECOND',
  [TokenType.YEARS]: 'YEARS',
  [TokenType.MONTHS]: 'MONTHS',
  [TokenType.WEEKS]: 'WEEKS',
  [TokenType.DAYS]: 'DAYS',
  [TokenType.HOURS]: 'HOURS',
  [TokenType.MINUTES]: 'MINUTES',
  [TokenType.SECONDS]: 'SECONDS',
  [TokenType.MILLISECONDS]: 'MILLISECONDS',
  [TokenType.EOF]: 'EOF',
  [TokenType.WHITESPACE]: 'WHITESPACE',
  [TokenType.COMMENT]: 'COMMENT',
  [TokenType.LINE_COMMENT]: 'LINE_COMMENT',
};

export function tokenTypeToString(type: TokenType): string {
  return TOKEN_TYPE_NAMES[type] || `UNKNOWN(${type})`;
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
  
  private throwUnexpectedCharCode(charCode: number): never {
    throw new Error(`Unexpected character '${String.fromCharCode(charCode)}' at position ${this.position}`);
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
    const firstChar = this.peek();
    
    if (firstChar !== "'" && firstChar !== '"') {
      return null;
    }
    
    const quoteChar = firstChar;
    this.advance(); // consume opening quote
    
    while (this.position < this.input.length) {
      const char = this.peek();
      
      if (char === quoteChar) {
        this.advance();
        return { type: TokenType.STRING, start, end: this.position, line: startLine, column: startColumn };
      }
      
      if (char === '\\') {
        this.advance();
        const escaped = this.peek();
        switch (escaped) {
          case '`':
          case "'":
          case '"':
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
  
  private readEnvVar(): Token | null {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    if (this.peek() !== '%') {
      return null;
    }
    
    this.advance(); // %
    
    // Check what follows the %
    const nextChar = this.peek();
    
    if (nextChar === "'") {
      // String form: %'string'
      this.advance(); // '
      
      while (this.position < this.input.length) {
        const char = this.peek();
        
        if (char === "'") {
          this.advance();
          return { type: TokenType.ENV_VAR, start, end: this.position, line: startLine, column: startColumn };
        }
        
        if (char === '\\') {
          this.advance();
          const escaped = this.peek();
          switch (escaped) {
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
                  throw new Error(`Invalid unicode escape in environment variable at position ${this.position}`);
                }
              }
              break;
            default:
              throw new Error(`Invalid escape sequence \\${escaped} in environment variable at position ${this.position}`);
          }
        } else {
          this.advance();
        }
      }
      
      throw new Error(`Unterminated environment variable string at position ${start}`);
      
    } else if (nextChar === '`') {
      // Delimited form: %`delimited`
      this.advance(); // `
      
      while (this.position < this.input.length) {
        const char = this.peek();
        
        if (char === '`') {
          this.advance();
          return { type: TokenType.ENV_VAR, start, end: this.position, line: startLine, column: startColumn };
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
      
      throw new Error(`Unterminated environment variable delimiter at position ${start}`);
      
    } else {
      // Identifier form: %identifier (ASCII only per spec)
      const firstCharCode = this.peekCharCode();
      if (firstCharCode >= 0 && firstCharCode < 256 && IS_LETTER[firstCharCode]) {
        // Read identifier
        while (this.position < this.input.length) {
          const charCode = this.peekCharCode();
          if (charCode >= 0 && charCode < 256 && IS_LETTER_OR_DIGIT[charCode]) {
            this.advance();
          } else {
            break;
          }
        }
        
        return { type: TokenType.ENV_VAR, start, end: this.position, line: startLine, column: startColumn };
      } else {
        // Just a percent sign, not an env var
        this.position = start;
        this.line = startLine;
        this.column = startColumn;
        return null;
      }
    }
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
    const firstCharCode = this.peekCharCode();
    
    // Switch on character code for faster dispatch
    switch (firstCharCode) {
      // String literals
      case 39: // '
      case 34: // "
        return this.readString() || this.throwUnexpectedChar(String.fromCharCode(firstCharCode));
        
      // Delimited identifier
      case 96: // `
        return this.readDelimitedIdentifier() || this.throwUnexpectedChar(String.fromCharCode(firstCharCode));
        
      // DateTime/Time or AT operator
      case 64: // @
        const dt = this.readDateTime();
        if (dt) return dt;
        // If not datetime, it's AT operator
        this.advance();
        return { type: TokenType.AT, start, end: this.position, line: startLine, column: startColumn };
        
      // Special identifiers
      case 36: // $
        return this.readSpecialIdentifier() || this.throwUnexpectedChar(String.fromCharCode(firstCharCode));
        
      // Environment variable or percent
      case 37: // %
        const envVar = this.readEnvVar();
        if (envVar) return envVar;
        // If not an env var, it's just a percent operator
        this.advance();
        return { type: TokenType.PERCENT, start, end: this.position, line: startLine, column: startColumn };
        
      // Single-character operators
      case 46: // .
        this.advance();
        return { type: TokenType.DOT, start, end: this.position, line: startLine, column: startColumn };
      case 40: // (
        this.advance();
        return { type: TokenType.LPAREN, start, end: this.position, line: startLine, column: startColumn };
      case 41: // )
        this.advance();
        return { type: TokenType.RPAREN, start, end: this.position, line: startLine, column: startColumn };
      case 91: // [
        this.advance();
        return { type: TokenType.LBRACKET, start, end: this.position, line: startLine, column: startColumn };
      case 93: // ]
        this.advance();
        return { type: TokenType.RBRACKET, start, end: this.position, line: startLine, column: startColumn };
      case 123: // {
        this.advance();
        return { type: TokenType.LBRACE, start, end: this.position, line: startLine, column: startColumn };
      case 125: // }
        this.advance();
        return { type: TokenType.RBRACE, start, end: this.position, line: startLine, column: startColumn };
      case 43: // +
        this.advance();
        return { type: TokenType.PLUS, start, end: this.position, line: startLine, column: startColumn };
      case 45: // -
        this.advance();
        return { type: TokenType.MINUS, start, end: this.position, line: startLine, column: startColumn };
      case 42: // *
        this.advance();
        return { type: TokenType.MULTIPLY, start, end: this.position, line: startLine, column: startColumn };
      case 47: // /
        this.advance();
        return { type: TokenType.DIVIDE, start, end: this.position, line: startLine, column: startColumn };
      case 38: // &
        this.advance();
        return { type: TokenType.AMPERSAND, start, end: this.position, line: startLine, column: startColumn };
      case 124: // |
        this.advance();
        return { type: TokenType.PIPE, start, end: this.position, line: startLine, column: startColumn };
      case 126: // ~
        this.advance();
        return { type: TokenType.SIMILAR, start, end: this.position, line: startLine, column: startColumn };
      case 44: // ,
        this.advance();
        return { type: TokenType.COMMA, start, end: this.position, line: startLine, column: startColumn };
      case 61: // =
        this.advance();
        return { type: TokenType.EQ, start, end: this.position, line: startLine, column: startColumn };
        
      // Two-character operators starting with <
      case 60: // <
        this.advance();
        if (this.peekCharCode() === 61) { // =
          this.advance();
          return { type: TokenType.LTE, start, end: this.position, line: startLine, column: startColumn };
        }
        return { type: TokenType.LT, start, end: this.position, line: startLine, column: startColumn };
        
      // Two-character operators starting with >
      case 62: // >
        this.advance();
        if (this.peekCharCode() === 61) { // =
          this.advance();
          return { type: TokenType.GTE, start, end: this.position, line: startLine, column: startColumn };
        }
        return { type: TokenType.GT, start, end: this.position, line: startLine, column: startColumn };
        
      // Two-character operators starting with !
      case 33: // !
        this.advance();
        const nextCharCode = this.peekCharCode();
        if (nextCharCode === 61) { // =
          this.advance();
          return { type: TokenType.NEQ, start, end: this.position, line: startLine, column: startColumn };
        } else if (nextCharCode === 126) { // ~
          this.advance();
          return { type: TokenType.NOT_SIMILAR, start, end: this.position, line: startLine, column: startColumn };
        }
        throw new Error(`Unexpected character '!' at position ${this.position - 1}`);
        
      default:
        // Inline digit check
        if (firstCharCode >= 0 && firstCharCode < 256 && IS_DIGIT[firstCharCode]) {
          return this.readNumber() || this.throwUnexpectedChar(String.fromCharCode(firstCharCode));
        }
        
        // Inline letter check
        if (firstCharCode >= 0 && firstCharCode < 256 && IS_LETTER[firstCharCode]) {
          return this.readIdentifierOrKeyword() || this.throwUnexpectedChar(String.fromCharCode(firstCharCode));
        }
        
        // EOF check
        if (firstCharCode === -1) {
          return { type: TokenType.EOF, start: this.position, end: this.position, line: this.line, column: this.column };
        }
        
        // Unknown character
        const unknownChar = firstCharCode < 256 ? String.fromCharCode(firstCharCode) : this.peek();
        throw new Error(`Unexpected character '${unknownChar}' at position ${this.position}`);
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
  
  // Debug helper to print tokens in human-readable format
  public debugTokens(tokens?: Token[]): string {
    if (!tokens) {
      // Save current position and reset
      const savedPosition = this.position;
      const savedLine = this.line;
      const savedColumn = this.column;
      this.position = 0;
      this.line = 1;
      this.column = 1;
      
      tokens = this.tokenize();
      
      // Restore position
      this.position = savedPosition;
      this.line = savedLine;
      this.column = savedColumn;
    }
    
    return tokens.map(token => {
      const value = this.getTokenValue(token);
      const type = tokenTypeToString(token.type);
      return `${type}(${value}) [${token.line}:${token.column}]`;
    }).join('\n');
  }
}