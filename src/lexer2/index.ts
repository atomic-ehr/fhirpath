export enum TokenType {
  // Non-operators (no precedence)
  // Literals
  NULL = 0x0001,
  BOOLEAN = 0x0002,
  STRING = 0x0003,
  NUMBER = 0x0004,
  DATETIME = 0x0005,
  TIME = 0x0006,
  
  // Identifiers
  IDENTIFIER = 0x0007,
  DELIMITED_IDENTIFIER = 0x0008,
  
  // Keywords (some used as operators with precedence)
  TRUE = 0x0009,
  FALSE = 0x000A,
  
  // Special identifiers
  THIS = 0x000B,
  INDEX = 0x000C,
  TOTAL = 0x000D,
  
  // Environment variable
  ENV_VAR = 0x000E,
  
  // Date/time units
  YEAR = 0x000F,
  MONTH = 0x0010,
  WEEK = 0x0011,
  DAY = 0x0012,
  HOUR = 0x0013,
  MINUTE = 0x0014,
  SECOND = 0x0015,
  MILLISECOND = 0x0016,
  YEARS = 0x0017,
  MONTHS = 0x0018,
  WEEKS = 0x0019,
  DAYS = 0x001A,
  HOURS = 0x001B,
  MINUTES = 0x001C,
  SECONDS = 0x001D,
  MILLISECONDS = 0x001E,
  
  // Special
  EOF = 0x001F,
  WHITESPACE = 0x0020,
  COMMENT = 0x0021,
  LINE_COMMENT = 0x0022,
  
  // Operators with precedence (0xPPXX where PP is precedence in hex)
  // Precedence 5
  PIPE = 0x0501,           // precedence 5
  
  // Precedence 10
  IMPLIES = 0x0A01,        // precedence 10
  
  // Precedence 20
  OR = 0x1401,             // precedence 20
  XOR = 0x1402,            // precedence 20
  
  // Precedence 30
  AND = 0x1E01,            // precedence 30
  
  // Precedence 35
  IN = 0x2301,             // precedence 35
  CONTAINS = 0x2302,       // precedence 35
  
  // Precedence 40
  EQ = 0x2801,             // precedence 40
  NEQ = 0x2802,            // precedence 40
  SIMILAR = 0x2803,        // precedence 40
  NOT_SIMILAR = 0x2804,    // precedence 40
  
  // Precedence 50
  LT = 0x3201,             // precedence 50
  GT = 0x3202,             // precedence 50
  LTE = 0x3203,            // precedence 50
  GTE = 0x3204,            // precedence 50
  
  // Precedence 60
  AMPERSAND = 0x3C01,      // precedence 60
  
  // Precedence 70
  PLUS = 0x4601,           // precedence 70
  MINUS = 0x4602,          // precedence 70
  
  // Precedence 80
  MULTIPLY = 0x5001,       // precedence 80
  DIVIDE = 0x5002,         // precedence 80
  DIV = 0x5003,            // precedence 80
  MOD = 0x5004,            // precedence 80
  
  // Precedence 90
  AS = 0x5A01,             // precedence 90
  IS = 0x5A02,             // precedence 90
  
  // Precedence 100
  DOT = 0x6401,            // precedence 100
  LBRACKET = 0x6402,       // precedence 100
  LPAREN = 0x6403,         // precedence 100
  
  // Non-operator tokens (no precedence)
  RPAREN = 0x0023,
  RBRACKET = 0x0024,
  LBRACE = 0x0025,
  RBRACE = 0x0026,
  COMMA = 0x0027,
  PERCENT = 0x0028,
  AT = 0x0029,
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

export enum Channel {
  REGULAR = 0,
  HIDDEN = 1,
}

export interface Token {
  type: TokenType;
  start: number;
  end: number;
  line: number;
  column: number;
  channel?: Channel;
}

export interface LexerOptions {
  skipWhitespace?: boolean;
  skipComments?: boolean;
  preserveTrivia?: boolean;  // When true, whitespace/comments get Channel.HIDDEN
  trackPosition?: boolean;   // When false, skip line/column tracking for performance
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
      preserveTrivia: options.preserveTrivia ?? false,
      trackPosition: options.trackPosition ?? true,
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
    
    // Update line and column only if tracking position
    if (this.options.trackPosition) {
      if (char === '\n') {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
    }
    
    return char;
  }
  
  private createToken(type: TokenType, start: number, end: number, startLine: number, startColumn: number): Token {
    return {
      type,
      start,
      end,
      line: this.options.trackPosition ? startLine : 0,
      column: this.options.trackPosition ? startColumn : 0
    };
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
          if (this.options.trackPosition) {
            this.column++;
          }
          break;
        case 13:  // '\r' (carriage return)
          this.position++;
          // Don't update column for \r
          break;
        case 10:  // '\n' (line feed)
          this.position++;
          if (this.options.trackPosition) {
            this.line++;
            this.column = 1;
          }
          break;
        default:
          // Not whitespace, exit loop
          if (this.position > start) {
            const token = this.createToken(TokenType.WHITESPACE, start, this.position, startLine, startColumn);
            if (this.options.preserveTrivia) {
              token.channel = Channel.HIDDEN;
            }
            return token;
          }
          return null;
      }
    }
    
    // Reached end of input
    if (this.position > start) {
      const token = this.createToken(TokenType.WHITESPACE, start, this.position, startLine, startColumn);
      if (this.options.preserveTrivia) {
        token.channel = Channel.HIDDEN;
      }
      return token;
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
      
      const token: Token = { type: TokenType.COMMENT, start, end: this.position, line: startLine, column: startColumn };
      if (this.options.preserveTrivia) {
        token.channel = Channel.HIDDEN;
      }
      return token;
    }
    
    if (this.peek() === '/' && this.peek(1) === '/') {
      this.advance(); // /
      this.advance(); // /
      
      while (this.position < this.input.length && this.peek() !== '\n') {
        this.advance();
      }
      
      const token: Token = { type: TokenType.LINE_COMMENT, start, end: this.position, line: startLine, column: startColumn };
      if (this.options.preserveTrivia) {
        token.channel = Channel.HIDDEN;
      }
      return token;
    }
    
    return null;
  }
  
  private readString(): Token | null {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    // Inline peekCharCode
    if (this.position >= this.input.length) return null;
    const firstCharCode = this.input.charCodeAt(this.position);
    
    if (firstCharCode !== 39 && firstCharCode !== 34) { // ' and "
      return null;
    }
    
    const quoteCharCode = firstCharCode;
    // Inline advance
    this.position++;
    this.column++;
    
    while (this.position < this.input.length) {
      const charCode = this.input.charCodeAt(this.position);
      
      if (charCode === quoteCharCode) {
        // Inline advance
        this.position++;
        this.column++;
        return { type: TokenType.STRING, start, end: this.position, line: startLine, column: startColumn };
      }
      
      if (charCode === 92) { // \
        // Inline advance
        this.position++;
        this.column++;
        
        if (this.position >= this.input.length) {
          throw new Error(`Invalid escape sequence at position ${this.position}`);
        }
        const escapedCode = this.input.charCodeAt(this.position);
        
        switch (escapedCode) {
          case 96:  // `
          case 39:  // '
          case 34:  // "
          case 92:  // \
          case 47:  // /
          case 102: // f
          case 110: // n
          case 114: // r
          case 116: // t
            // Inline advance
            this.position++;
            this.column++;
            break;
          case 117: // u
            // Inline advance
            this.position++;
            this.column++;
            // Read 4 hex digits
            for (let i = 0; i < 4; i++) {
              if (this.position >= this.input.length) {
                throw new Error(`Invalid unicode escape at position ${this.position}`);
              }
              const hexCode = this.input.charCodeAt(this.position);
              if (IS_HEX_DIGIT[hexCode]) {
                this.position++;
                this.column++;
              } else {
                throw new Error(`Invalid unicode escape at position ${this.position}`);
              }
            }
            break;
          default:
            const escaped = String.fromCharCode(escapedCode);
            throw new Error(`Invalid escape sequence \\${escaped} at position ${this.position}`);
        }
      } else if (charCode === 10) { // \n
        // Handle newline
        this.position++;
        this.line++;
        this.column = 1;
      } else {
        // Regular character - inline advance
        this.position++;
        this.column++;
      }
    }
    
    throw new Error(`Unterminated string at position ${start}`);
  }
  
  private readDelimitedIdentifier(): Token | null {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;    
    if (this.peekCharCode() !== 96) { // `
      return null;
    }
    
    this.advance(); // `
    
    while (this.position < this.input.length) {
      const charCode = this.peekCharCode();
      
      if (charCode === 96) { // `
        this.advance();
        return { type: TokenType.DELIMITED_IDENTIFIER, start, end: this.position, line: startLine, column: startColumn };
      }
      
      if (charCode === 92) { // \
        this.advance();
        const escapedCode = this.peekCharCode();
        if (escapedCode === 96 || escapedCode === 92) { // ` or \
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
    
    // Inline digit reading loop with inlined advance
    while (this.position < this.input.length) {
      const charCode = this.input.charCodeAt(this.position);
      if (IS_DIGIT[charCode]) {
        this.position++;
        this.column++;
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
          // Inline decimal digit reading with inlined advance
          while (this.position < this.input.length) {
            const charCode = this.input.charCodeAt(this.position);
            if (IS_DIGIT[charCode]) {
              this.position++;
              this.column++;
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
      if (charCode === -1 || !IS_DIGIT[charCode]) {
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
      if (monthChar0 === -1 || !IS_DIGIT[monthChar0] || 
          monthChar1 === -1 || !IS_DIGIT[monthChar1]) {
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
        if (dayChar0 === -1 || !IS_DIGIT[dayChar0] || 
            dayChar1 === -1 || !IS_DIGIT[dayChar1]) {
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
      if (tzChar0 === -1 || !IS_DIGIT[tzChar0] || 
          tzChar1 === -1 || !IS_DIGIT[tzChar1]) {
        // Invalid timezone offset
      } else {
        this.advance();
        this.advance();
        if (this.peek() === ':') {
          this.advance();
          const tzMinChar0 = this.peekCharCode();
          const tzMinChar1 = this.peekCharCode(1);
          if (tzMinChar0 !== -1 && IS_DIGIT[tzMinChar0] && 
              tzMinChar1 !== -1 && IS_DIGIT[tzMinChar1]) {
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
    if (hhChar0 === -1 || !IS_DIGIT[hhChar0] || 
        hhChar1 === -1 || !IS_DIGIT[hhChar1]) {
      return false;
    }
    this.advance();
    this.advance();
    
    // Optional :MM
    if (this.peek() === ':') {
      this.advance();
      const mmChar0 = this.peekCharCode();
      const mmChar1 = this.peekCharCode(1);
      if (mmChar0 === -1 || !IS_DIGIT[mmChar0] || 
          mmChar1 === -1 || !IS_DIGIT[mmChar1]) {
        return false;
      }
      this.advance();
      this.advance();
      
      // Optional :SS
      if (this.peek() === ':') {
        this.advance();
        const ssChar0 = this.peekCharCode();
        const ssChar1 = this.peekCharCode(1);
        if (ssChar0 === -1 || !IS_DIGIT[ssChar0] || 
            ssChar1 === -1 || !IS_DIGIT[ssChar1]) {
          return false;
        }
        this.advance();
        this.advance();
        
        // Optional .fraction
        if (this.peek() === '.') {
          this.advance();
          const fracChar = this.peekCharCode();
          if (fracChar === -1 || !IS_DIGIT[fracChar]) {
            return false;
          }
          while (this.position < this.input.length) {
            const charCode = this.peekCharCode();
            if (charCode !== -1 && IS_DIGIT[charCode]) {
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
    
    // Inline letter/digit reading loop with inlined advance
    while (this.position < this.input.length) {
      const charCode = this.input.charCodeAt(this.position);
      if (IS_LETTER_OR_DIGIT[charCode]) {
        this.position++;
        this.column++;
      } else {
        break;
      }
    }
    
    const length = this.position - start;
    
    // Check for keywords directly from input buffer without substring
    let type: TokenType = TokenType.IDENTIFIER;
    const input = this.input;
    
    switch (length) {
      case 2:
        const c0_2 = input.charCodeAt(start);
        const c1_2 = input.charCodeAt(start + 1);
        if (c0_2 === 97 && c1_2 === 115) type = TokenType.AS; // 'as'
        else if (c0_2 === 105 && c1_2 === 110) type = TokenType.IN; // 'in'
        else if (c0_2 === 105 && c1_2 === 115) type = TokenType.IS; // 'is'
        else if (c0_2 === 111 && c1_2 === 114) type = TokenType.OR; // 'or'
        break;
      case 3:
        const c0_3 = input.charCodeAt(start);
        const c1_3 = input.charCodeAt(start + 1);
        const c2_3 = input.charCodeAt(start + 2);
        if (c0_3 === 100 && c1_3 === 105 && c2_3 === 118) type = TokenType.DIV; // 'div'
        else if (c0_3 === 109 && c1_3 === 111 && c2_3 === 100) type = TokenType.MOD; // 'mod'
        else if (c0_3 === 97 && c1_3 === 110 && c2_3 === 100) type = TokenType.AND; // 'and'
        else if (c0_3 === 120 && c1_3 === 111 && c2_3 === 114) type = TokenType.XOR; // 'xor'
        else if (c0_3 === 100 && c1_3 === 97 && c2_3 === 121) type = TokenType.DAY; // 'day'
        break;
      case 4:
        const c0_4 = input.charCodeAt(start);
        if (c0_4 === 116 && // 't'
            input.charCodeAt(start + 1) === 114 && // 'r'
            input.charCodeAt(start + 2) === 117 && // 'u'
            input.charCodeAt(start + 3) === 101) { // 'e'
          type = TokenType.TRUE;
        } else if (c0_4 === 121 && // 'y'
                   input.charCodeAt(start + 1) === 101 && // 'e'
                   input.charCodeAt(start + 2) === 97 && // 'a'
                   input.charCodeAt(start + 3) === 114) { // 'r'
          type = TokenType.YEAR;
        } else if (c0_4 === 119 && // 'w'
                   input.charCodeAt(start + 1) === 101 && // 'e'
                   input.charCodeAt(start + 2) === 101 && // 'e'
                   input.charCodeAt(start + 3) === 107) { // 'k'
          type = TokenType.WEEK;
        } else if (c0_4 === 104 && // 'h'
                   input.charCodeAt(start + 1) === 111 && // 'o'
                   input.charCodeAt(start + 2) === 117 && // 'u'
                   input.charCodeAt(start + 3) === 114) { // 'r'
          type = TokenType.HOUR;
        } else if (c0_4 === 100 && // 'd'
                   input.charCodeAt(start + 1) === 97 && // 'a'
                   input.charCodeAt(start + 2) === 121 && // 'y'
                   input.charCodeAt(start + 3) === 115) { // 's'
          type = TokenType.DAYS;
        }
        break;
      case 5:
        const c0_5 = input.charCodeAt(start);
        if (c0_5 === 102 && // 'f'
            input.charCodeAt(start + 1) === 97 && // 'a'
            input.charCodeAt(start + 2) === 108 && // 'l'
            input.charCodeAt(start + 3) === 115 && // 's'
            input.charCodeAt(start + 4) === 101) { // 'e'
          type = TokenType.FALSE;
        } else if (c0_5 === 109 && // 'm'
                   input.charCodeAt(start + 1) === 111 && // 'o'
                   input.charCodeAt(start + 2) === 110 && // 'n'
                   input.charCodeAt(start + 3) === 116 && // 't'
                   input.charCodeAt(start + 4) === 104) { // 'h'
          type = TokenType.MONTH;
        } else if (c0_5 === 119 && // 'w'
                   input.charCodeAt(start + 1) === 101 && // 'e'
                   input.charCodeAt(start + 2) === 101 && // 'e'
                   input.charCodeAt(start + 3) === 107 && // 'k'
                   input.charCodeAt(start + 4) === 115) { // 's'
          type = TokenType.WEEKS;
        } else if (c0_5 === 121 && // 'y'
                   input.charCodeAt(start + 1) === 101 && // 'e'
                   input.charCodeAt(start + 2) === 97 && // 'a'
                   input.charCodeAt(start + 3) === 114 && // 'r'
                   input.charCodeAt(start + 4) === 115) { // 's'
          type = TokenType.YEARS;
        } else if (c0_5 === 104 && // 'h'
                   input.charCodeAt(start + 1) === 111 && // 'o'
                   input.charCodeAt(start + 2) === 117 && // 'u'
                   input.charCodeAt(start + 3) === 114 && // 'r'
                   input.charCodeAt(start + 4) === 115) { // 's'
          type = TokenType.HOURS;
        }
        break;
      default:
        // For longer keywords, fall back to substring
        const value = input.substring(start, this.position);
        switch (length) {
          case 6:
            if (value === 'minute') type = TokenType.MINUTE;
            else if (value === 'second') type = TokenType.SECOND;
            else if (value === 'months') type = TokenType.MONTHS;
            break;
          case 7:
            if (value === 'implies') type = TokenType.IMPLIES;
            else if (value === 'minutes') type = TokenType.MINUTES;
            else if (value === 'seconds') type = TokenType.SECONDS;
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
        break;
    }
    
    return { type, start, end: this.position, line: startLine, column: startColumn };
  }
  
  private readSpecialIdentifier(): Token | null {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;    
    if (this.position >= this.input.length || this.input.charCodeAt(this.position) !== 36) { // $
      return null;
    }
    
    const len = this.input.length;
    const pos = this.position;
    
    // Check for $this (5 chars)
    if (pos + 4 < len &&
        this.input.charCodeAt(pos + 1) === 116 && // t
        this.input.charCodeAt(pos + 2) === 104 && // h
        this.input.charCodeAt(pos + 3) === 105 && // i
        this.input.charCodeAt(pos + 4) === 115) { // s
      this.position += 5;
      this.column += 5;
      return { type: TokenType.THIS, start, end: this.position, line: startLine, column: startColumn };
    }
    
    // Check for $index (6 chars)
    if (pos + 5 < len &&
        this.input.charCodeAt(pos + 1) === 105 && // i
        this.input.charCodeAt(pos + 2) === 110 && // n
        this.input.charCodeAt(pos + 3) === 100 && // d
        this.input.charCodeAt(pos + 4) === 101 && // e
        this.input.charCodeAt(pos + 5) === 120) { // x
      this.position += 6;
      this.column += 6;
      return { type: TokenType.INDEX, start, end: this.position, line: startLine, column: startColumn };
    }
    
    // Check for $total (6 chars)
    if (pos + 5 < len &&
        this.input.charCodeAt(pos + 1) === 116 && // t
        this.input.charCodeAt(pos + 2) === 111 && // o
        this.input.charCodeAt(pos + 3) === 116 && // t
        this.input.charCodeAt(pos + 4) === 97 &&  // a
        this.input.charCodeAt(pos + 5) === 108) { // l
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
    
    if (this.peekCharCode() !== 37) { // %
      return null;
    }
    
    this.advance(); // %
    
    // Check what follows the %
    const nextCharCode = this.peekCharCode();
    
    if (nextCharCode === 39) { // '
      // String form: %'string'
      this.advance(); // '
      
      while (this.position < this.input.length) {
        const charCode = this.peekCharCode();
        
        if (charCode === 39) { // '
          this.advance();
          return { type: TokenType.ENV_VAR, start, end: this.position, line: startLine, column: startColumn };
        }
        
        if (charCode === 92) { // \
          this.advance();
          const escapedCode = this.peekCharCode();
          switch (escapedCode) {
            case 39:  // '
            case 92:  // \
            case 47:  // /
            case 102: // f
            case 110: // n
            case 114: // r
            case 116: // t
              this.advance();
              break;
            case 117: // u
              this.advance();
              for (let i = 0; i < 4; i++) {
                const hexCode = this.peekCharCode();
                if (hexCode !== -1 && IS_HEX_DIGIT[hexCode]) {
                  this.advance();
                } else {
                  throw new Error(`Invalid unicode escape in environment variable at position ${this.position}`);
                }
              }
              break;
            default:
              const escaped = escapedCode === -1 ? '' : String.fromCharCode(escapedCode);
              throw new Error(`Invalid escape sequence \\${escaped} in environment variable at position ${this.position}`);
          }
        } else {
          this.advance();
        }
      }
      
      throw new Error(`Unterminated environment variable string at position ${start}`);
      
    } else if (nextCharCode === 96) { // `
      // Delimited form: %`delimited`
      this.advance(); // `
      
      while (this.position < this.input.length) {
        const charCode = this.peekCharCode();
        
        if (charCode === 96) { // `
          this.advance();
          return { type: TokenType.ENV_VAR, start, end: this.position, line: startLine, column: startColumn };
        }
        
        if (charCode === 92) { // \
          this.advance();
          const escapedCode = this.peekCharCode();
          if (escapedCode === 96 || escapedCode === 92) { // ` or \
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
      if (firstCharCode !== -1 && IS_LETTER[firstCharCode]) {
        // Read identifier
        while (this.position < this.input.length) {
          const charCode = this.peekCharCode();
          if (charCode !== -1 && IS_LETTER_OR_DIGIT[charCode]) {
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
        if (this.options.preserveTrivia || !this.options.skipWhitespace) return wsToken;
        continue;
      }
      
      const commentToken = this.readComment();
      if (commentToken) {
        if (this.options.preserveTrivia || !this.options.skipComments) return commentToken;
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
        this.position++;
        this.column++;
        return { type: TokenType.PERCENT, start, end: this.position, line: startLine, column: startColumn };
        
      // Single-character operators
      case 46: // .
        this.position++;
        this.column++;
        return { type: TokenType.DOT, start, end: this.position, line: startLine, column: startColumn };
      case 40: // (
        this.position++;
        this.column++;
        return { type: TokenType.LPAREN, start, end: this.position, line: startLine, column: startColumn };
      case 41: // )
        this.position++;
        this.column++;
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
        this.position++;
        this.column++;
        return { type: TokenType.PLUS, start, end: this.position, line: startLine, column: startColumn };
      case 45: // -
        this.position++;
        this.column++;
        return { type: TokenType.MINUS, start, end: this.position, line: startLine, column: startColumn };
      case 42: // *
        this.position++;
        this.column++;
        return { type: TokenType.MULTIPLY, start, end: this.position, line: startLine, column: startColumn };
      case 47: // /
        this.position++;
        this.column++;
        return { type: TokenType.DIVIDE, start, end: this.position, line: startLine, column: startColumn };
      case 38: // &
        this.position++;
        this.column++;
        return { type: TokenType.AMPERSAND, start, end: this.position, line: startLine, column: startColumn };
      case 124: // |
        this.position++;
        this.column++;
        return { type: TokenType.PIPE, start, end: this.position, line: startLine, column: startColumn };
      case 126: // ~
        this.advance();
        return { type: TokenType.SIMILAR, start, end: this.position, line: startLine, column: startColumn };
      case 44: // ,
        this.advance();
        return { type: TokenType.COMMA, start, end: this.position, line: startLine, column: startColumn };
      case 61: // =
        this.position++;
        this.column++;
        return { type: TokenType.EQ, start, end: this.position, line: startLine, column: startColumn };
        
      // Two-character operators starting with <
      case 60: // <
        this.position++;
        this.column++;
        if (this.peekCharCode() === 61) { // =
          this.position++;
          this.column++;
          return { type: TokenType.LTE, start, end: this.position, line: startLine, column: startColumn };
        }
        return { type: TokenType.LT, start, end: this.position, line: startLine, column: startColumn };
        
      // Two-character operators starting with >
      case 62: // >
        this.position++;
        this.column++;
        if (this.peekCharCode() === 61) { // =
          this.position++;
          this.column++;
          return { type: TokenType.GTE, start, end: this.position, line: startLine, column: startColumn };
        }
        return { type: TokenType.GT, start, end: this.position, line: startLine, column: startColumn };
        
      // Two-character operators starting with !
      case 33: // !
        this.position++;
        this.column++;
        const nextCharCode = this.peekCharCode();
        if (nextCharCode === 61) { // =
          this.position++;
          this.column++;
          return { type: TokenType.NEQ, start, end: this.position, line: startLine, column: startColumn };
        } else if (nextCharCode === 126) { // ~
          this.position++;
          this.column++;
          return { type: TokenType.NOT_SIMILAR, start, end: this.position, line: startLine, column: startColumn };
        }
        throw new Error(`Unexpected character '!' at position ${this.position - 1}`);
        
      // EOF
      case -1:
        return { type: TokenType.EOF, start: this.position, end: this.position, line: this.line, column: this.column };
        
      default:
        // Check if it's a digit (0-9)
        if (IS_DIGIT[firstCharCode]) {
          return this.readNumber() || this.throwUnexpectedChar(String.fromCharCode(firstCharCode));
        }
        
        // Check if it's a letter (A-Z, a-z, _)
        if (IS_LETTER[firstCharCode]) {
          return this.readIdentifierOrKeyword() || this.throwUnexpectedChar(String.fromCharCode(firstCharCode));
        }
        
        // Unknown character
        const unknownChar = String.fromCharCode(firstCharCode);
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