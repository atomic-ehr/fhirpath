import { TokenType, Token, Channel } from './lexer';
import type { LexerOptions } from './lexer';
import { Registry, defaultRegistry } from './registry';

// Map for symbols that aren't operators but still need tokens
const NON_OPERATOR_SYMBOLS: Record<string, TokenType> = {
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

// Keywords that map to specific tokens
const KEYWORD_TOKENS: Record<string, TokenType> = {
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

export class RegistryBasedLexer {
  private input: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private options: LexerOptions;
  private registry: Registry;
  
  // Cache symbol lookups for performance
  private symbolToTokenCache: Map<string, TokenType> = new Map();
  private keywordToTokenCache: Map<string, TokenType> = new Map();
  
  constructor(input: string, options: LexerOptions = {}, registry?: Registry) {
    this.input = input;
    this.options = {
      skipWhitespace: options.skipWhitespace ?? true,
      skipComments: options.skipComments ?? true,
      preserveTrivia: options.preserveTrivia ?? false,
      trackPosition: options.trackPosition ?? true,
    };
    this.registry = registry || defaultRegistry;
    this.buildCaches();
  }
  
  private buildCaches(): void {
    // Build symbol cache from registry
    this.symbolToTokenCache = this.registry.getAllBinaryOperatorSymbols();
    
    // Add keyword operators from registry
    this.keywordToTokenCache = this.registry.getAllOperatorKeywords();
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
    
    while (this.position < this.input.length) {
      const char = this.peek();
      if (char === ' ' || char === '\t' || char === '\r' || char === '\n') {
        this.advance();
      } else {
        break;
      }
    }
    
    if (this.position > start) {
      const token = this.createToken(TokenType.WHITESPACE, start, this.position, startLine, startColumn);
      if (this.options.preserveTrivia) {
        token.channel = Channel.HIDDEN;
      }
      return token;
    }
    
    return null;
  }
  
  private readIdentifierOrKeyword(): Token | null {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    // First character must be letter or underscore
    const firstChar = this.peek();
    if (!(/[a-zA-Z_]/.test(firstChar))) {
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
    
    // Check if it's a keyword from our static map
    const keywordToken = KEYWORD_TOKENS[value];
    if (keywordToken !== undefined) {
      return this.createToken(keywordToken, start, this.position, startLine, startColumn);
    }
    
    // Check if it's a keyword operator from registry
    const operatorToken = this.keywordToTokenCache.get(value);
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
      
      // Check registry first
      const registryToken = this.symbolToTokenCache.get(twoChar);
      if (registryToken !== undefined) {
        this.advance();
        this.advance();
        return this.createToken(registryToken, start, this.position, startLine, startColumn);
      }
      
      // Special two-char operators not in registry
      switch (twoChar) {
        case '!=':
          this.advance();
          this.advance();
          return this.createToken(TokenType.NEQ, start, this.position, startLine, startColumn);
        case '<=':
          this.advance();
          this.advance();
          return this.createToken(TokenType.LTE, start, this.position, startLine, startColumn);
        case '>=':
          this.advance();
          this.advance();
          return this.createToken(TokenType.GTE, start, this.position, startLine, startColumn);
        case '!~':
          this.advance();
          this.advance();
          return this.createToken(TokenType.NOT_SIMILAR, start, this.position, startLine, startColumn);
      }
    }
    
    // Try single-character operators
    const oneChar = this.peek();
    
    // Check registry first
    const registryToken = this.symbolToTokenCache.get(oneChar);
    if (registryToken !== undefined) {
      this.advance();
      return this.createToken(registryToken, start, this.position, startLine, startColumn);
    }
    
    // Check non-operator symbols
    const nonOpToken = NON_OPERATOR_SYMBOLS[oneChar];
    if (nonOpToken !== undefined) {
      this.advance();
      return this.createToken(nonOpToken, start, this.position, startLine, startColumn);
    }
    
    // Special single-char operators that might not be in registry yet
    const specialTokens: Record<string, TokenType> = {
      '<': TokenType.LT,
      '>': TokenType.GT,
      '~': TokenType.SIMILAR,
      '&': TokenType.AMPERSAND,
      '|': TokenType.PIPE,
    };
    
    const specialToken = specialTokens[oneChar];
    if (specialToken !== undefined) {
      this.advance();
      return this.createToken(specialToken, start, this.position, startLine, startColumn);
    }
    
    return null;
  }
  
  private readNumber(): Token | null {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    // Must start with digit
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
    // Skip whitespace and comments if configured
    while (this.position < this.input.length) {
      const wsToken = this.readWhitespace();
      if (wsToken) {
        if (this.options.preserveTrivia || !this.options.skipWhitespace) return wsToken;
        continue;
      }
      
      // Add comment handling here if needed
      
      break;
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
}