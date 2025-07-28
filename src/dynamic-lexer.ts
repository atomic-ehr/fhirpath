import { TokenType, TokenTypeValue } from './registry-tokens';
import { DynamicRegistry } from './dynamic-registry';

export interface Token {
  type: TokenTypeValue;
  start: number;
  end: number;
  line: number;
  column: number;
}

export interface LexerOptions {
  skipWhitespace?: boolean;
  skipComments?: boolean;
  trackPosition?: boolean;
}

// Static delimiters that don't change
const STATIC_SYMBOLS: Record<string, TokenTypeValue> = {
  '(': TokenType.LPAREN,
  ')': TokenType.RPAREN,
  '[': TokenType.LBRACKET,
  ']': TokenType.RBRACKET,
  '{': TokenType.LBRACE,
  '}': TokenType.RBRACE,
  ',': TokenType.COMMA,
  '.': TokenType.DOT,
  '%': TokenType.PERCENT,
  '@': TokenType.AT,
};

// Static keywords
const STATIC_KEYWORDS: Record<string, TokenTypeValue> = {
  'true': TokenType.TRUE,
  'false': TokenType.FALSE,
  '$this': TokenType.THIS,
  '$index': TokenType.INDEX,
  '$total': TokenType.TOTAL,
  // Date/time units
  'year': TokenType.YEAR,
  'years': TokenType.YEARS,
  'month': TokenType.MONTH,
  'months': TokenType.MONTHS,
  'week': TokenType.WEEK,
  'weeks': TokenType.WEEKS,
  'day': TokenType.DAY,
  'days': TokenType.DAYS,
  'hour': TokenType.HOUR,
  'hours': TokenType.HOURS,
  'minute': TokenType.MINUTE,
  'minutes': TokenType.MINUTES,
  'second': TokenType.SECOND,
  'seconds': TokenType.SECONDS,
  'millisecond': TokenType.MILLISECOND,
  'milliseconds': TokenType.MILLISECONDS,
};

export class DynamicLexer {
  private input: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private options: LexerOptions;
  private registry: DynamicRegistry;
  private symbolTokens: Map<string, TokenTypeValue>;
  
  constructor(input: string, registry: DynamicRegistry, options: LexerOptions = {}) {
    this.input = input;
    this.registry = registry;
    this.options = {
      skipWhitespace: options.skipWhitespace ?? true,
      skipComments: options.skipComments ?? true,
      trackPosition: options.trackPosition ?? true,
    };
    
    // Build symbol lookup from registry
    this.symbolTokens = this.registry.getAllTokens();
  }
  
  private peek(offset: number = 0): string {
    const pos = this.position + offset;
    return pos < this.input.length ? this.input[pos] : '';
  }
  
  private advance(): string {
    if (this.position >= this.input.length) return '';
    
    const char = this.input[this.position];
    this.position++;
    
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
  
  private createToken(type: TokenTypeValue, start: number, end: number, startLine: number, startColumn: number): Token {
    return {
      type,
      start,
      end,
      line: this.options.trackPosition ? startLine : 0,
      column: this.options.trackPosition ? startColumn : 0
    };
  }
  
  private skipWhitespace(): void {
    while (this.position < this.input.length) {
      const char = this.peek();
      if (char === ' ' || char === '\t' || char === '\r' || char === '\n') {
        this.advance();
      } else {
        break;
      }
    }
  }
  
  private readIdentifierOrKeyword(): Token | null {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    // First character must be letter or underscore
    const firstChar = this.peek();
    if (!(/[a-zA-Z_$]/.test(firstChar))) {
      return null;
    }
    
    this.advance();
    
    // Read rest of identifier
    while (this.position < this.input.length) {
      const char = this.peek();
      if (/[a-zA-Z0-9_]/.test(char)) {
        this.advance();
      } else {
        break;
      }
    }
    
    const value = this.input.substring(start, this.position);
    
    // Check static keywords first
    const staticKeyword = STATIC_KEYWORDS[value];
    if (staticKeyword !== undefined) {
      return this.createToken(staticKeyword, start, this.position, startLine, startColumn);
    }
    
    // Check if it's an operator keyword from registry
    const operatorToken = this.symbolTokens.get(value);
    if (operatorToken !== undefined) {
      return this.createToken(operatorToken, start, this.position, startLine, startColumn);
    }
    
    // Default to identifier
    return this.createToken(TokenType.IDENTIFIER, start, this.position, startLine, startColumn);
  }
  
  private readSymbol(): Token | null {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    // Try two-character operators first
    if (this.position + 1 < this.input.length) {
      const twoChar = this.peek() + this.peek(1);
      
      // Check registry
      const registryToken = this.symbolTokens.get(twoChar);
      if (registryToken !== undefined) {
        this.advance();
        this.advance();
        return this.createToken(registryToken, start, this.position, startLine, startColumn);
      }
    }
    
    // Try single-character
    const oneChar = this.peek();
    
    // Check registry
    const registryToken = this.symbolTokens.get(oneChar);
    if (registryToken !== undefined) {
      this.advance();
      return this.createToken(registryToken, start, this.position, startLine, startColumn);
    }
    
    // Check static symbols
    const staticToken = STATIC_SYMBOLS[oneChar];
    if (staticToken !== undefined) {
      this.advance();
      return this.createToken(staticToken, start, this.position, startLine, startColumn);
    }
    
    return null;
  }
  
  private readNumber(): Token | null {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    if (!(/[0-9]/.test(this.peek()))) {
      return null;
    }
    
    // Read integer part
    while (/[0-9]/.test(this.peek())) {
      this.advance();
    }
    
    // Check for decimal part
    if (this.peek() === '.' && /[0-9]/.test(this.peek(1))) {
      this.advance(); // consume '.'
      while (/[0-9]/.test(this.peek())) {
        this.advance();
      }
    }
    
    return this.createToken(TokenType.NUMBER, start, this.position, startLine, startColumn);
  }
  
  private readString(): Token | null {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    const quote = this.peek();
    if (quote !== '"' && quote !== "'") {
      return null;
    }
    
    this.advance(); // consume opening quote
    
    while (this.position < this.input.length) {
      const char = this.peek();
      
      if (char === quote) {
        this.advance(); // consume closing quote
        return this.createToken(TokenType.STRING, start, this.position, startLine, startColumn);
      }
      
      if (char === '\\') {
        this.advance(); // consume backslash
        if (this.position < this.input.length) {
          this.advance(); // consume escaped character
        }
      } else {
        this.advance();
      }
    }
    
    throw new Error(`Unterminated string at position ${start}`);
  }
  
  public nextToken(): Token {
    if (this.options.skipWhitespace) {
      this.skipWhitespace();
    }
    
    if (this.position >= this.input.length) {
      return this.createToken(TokenType.EOF, this.position, this.position, this.line, this.column);
    }
    
    // Try different token types
    let token = this.readNumber();
    if (token) return token;
    
    token = this.readString();
    if (token) return token;
    
    token = this.readIdentifierOrKeyword();
    if (token) return token;
    
    token = this.readSymbol();
    if (token) return token;
    
    // Unknown character
    const char = this.peek();
    throw new Error(`Unexpected character '${char}' at position ${this.position}`);
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
  
  public getTokenName(token: Token): string {
    return this.registry.getTokenName(token.type);
  }
}