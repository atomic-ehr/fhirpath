// Copy of lexer with numeric token types for testing
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

// Export a simple test function
export function testNumericPerformance(input: string): Token[] {
  const tokens: Token[] = [];
  
  // Simulate simple tokenization
  let pos = 0;
  let line = 1;
  let column = 1;
  
  while (pos < input.length) {
    const char = input[pos];
    
    if (char === '.') {
      tokens.push({ type: TokenType.DOT, start: pos, end: pos + 1, line, column });
      pos++;
      column++;
    } else if (char === ' ') {
      pos++;
      column++;
    } else {
      // Identifier
      const start = pos;
      const startCol = column;
      while (pos < input.length && input[pos] !== '.' && input[pos] !== ' ') {
        pos++;
        column++;
      }
      tokens.push({ type: TokenType.IDENTIFIER, start, end: pos, line, column: startCol });
    }
  }
  
  tokens.push({ type: TokenType.EOF, start: pos, end: pos, line, column });
  return tokens;
}