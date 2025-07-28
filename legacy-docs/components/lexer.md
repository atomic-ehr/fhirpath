# Lexer Component

## Overview

The lexer (tokenizer) is the first stage in processing FHIRPath expressions. It converts a raw string input into a stream of tokens that can be consumed by the parser. The implementation focuses on performance through object pooling, string interning, and efficient character classification.

## Architecture

### Core Components

#### Main Lexer Class
**Location**: [`/src/lexer/lexer.ts`](../../src/lexer/lexer.ts)

The `FHIRPathLexer` class provides the primary tokenization functionality:

```typescript
export class FHIRPathLexer {
  private chars: string[];      // Character array for O(1) access
  private length: number;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokenPool = new TokenPool();
  
  constructor(input: string)
}
```

Key methods:
- `tokenize()`: Main entry point that returns an array of tokens
- `nextToken()`: Reads and returns the next token from input
- `skipWhitespace()`: Efficiently skips whitespace characters
- `scanIdentifier()`: Reads identifiers and keywords
- `scanNumber()`: Parses numeric literals
- `scanString()`: Handles string literals with escape sequences

### Token Types
**Location**: [`/src/lexer/token.ts`](../../src/lexer/token.ts)

The lexer recognizes these token types:

```typescript
export enum TokenType {
  // Literals
  LITERAL = 'LITERAL',            // Generic literal token
  NULL = 'NULL',                  // {} 
  TRUE = 'TRUE',                  // true
  FALSE = 'FALSE',                // false
  STRING = 'STRING',              // 'string value'
  NUMBER = 'NUMBER',              // 123, 45.67
  DATE = 'DATE',                  // @2024-01-15
  DATETIME = 'DATETIME',          // @2024-01-15T10:30:00Z
  TIME = 'TIME',                  // @T14:30:00
  
  // Identifiers
  IDENTIFIER = 'IDENTIFIER',      // [A-Za-z_][A-Za-z0-9_]*
  DELIMITED_IDENTIFIER = 'DELIMITED_IDENTIFIER', // `identifier`
  
  // Special variables
  THIS = 'THIS',                  // $this
  INDEX = 'INDEX',                // $index
  TOTAL = 'TOTAL',                // $total
  
  // Environment variables
  ENV_VAR = 'ENV_VAR',           // %context
  
  // Operators
  PLUS = 'PLUS',                 // +
  MINUS = 'MINUS',               // -
  STAR = 'STAR',                 // *
  SLASH = 'SLASH',               // /
  DIV = 'DIV',                   // div
  MOD = 'MOD',                   // mod
  CONCAT = 'CONCAT',             // &
  
  // Comparison
  EQ = 'EQ',                     // =
  NEQ = 'NEQ',                   // !=
  LT = 'LT',                     // <
  GT = 'GT',                     // >
  LTE = 'LTE',                   // <=
  GTE = 'GTE',                   // >=
  EQUIV = 'EQUIV',               // ~
  NEQUIV = 'NEQUIV',             // !~
  
  // Logical
  AND = 'AND',                   // and
  OR = 'OR',                     // or
  XOR = 'XOR',                   // xor
  IMPLIES = 'IMPLIES',           // implies
  NOT = 'NOT',                   // not
  
  // Delimiters
  LPAREN = 'LPAREN',             // (
  RPAREN = 'RPAREN',             // )
  LBRACKET = 'LBRACKET',         // [
  RBRACKET = 'RBRACKET',         // ]
  LBRACE = 'LBRACE',             // {
  RBRACE = 'RBRACE',             // }
  DOT = 'DOT',                   // .
  COMMA = 'COMMA',               // ,
  PIPE = 'PIPE',                 // |
  
  // Special
  EOF = 'EOF',
  UNIT = 'UNIT',                 // year, month, 'mg', etc.
}
```

### Character Classification
**Location**: [`/src/lexer/char-tables.ts`](../../src/lexer/char-tables.ts)

The lexer uses pre-computed character tables for O(1) character type lookups:

```typescript
// Character classification lookup table for O(1) checks
export const CHAR_FLAGS = new Uint8Array(128);

// Bit flags for character properties
export const FLAG_DIGIT = 1 << 0;
export const FLAG_ALPHA = 1 << 1;
export const FLAG_WHITESPACE = 1 << 2;
export const FLAG_IDENTIFIER_START = 1 << 3;
export const FLAG_IDENTIFIER_CONT = 1 << 4;

// Initialize lookup table
export function initCharTables(): void {
  // Digits
  for (let i = 48; i <= 57; i++) {
    CHAR_FLAGS[i] |= FLAG_DIGIT | FLAG_IDENTIFIER_CONT;
  }
  
  // Letters
  for (let i = 65; i <= 90; i++) {
    CHAR_FLAGS[i] |= FLAG_ALPHA | FLAG_IDENTIFIER_START | FLAG_IDENTIFIER_CONT;
  }
  for (let i = 97; i <= 122; i++) {
    CHAR_FLAGS[i] |= FLAG_ALPHA | FLAG_IDENTIFIER_START | FLAG_IDENTIFIER_CONT;
  }
  
  // Underscore
  CHAR_FLAGS[95] |= FLAG_IDENTIFIER_START | FLAG_IDENTIFIER_CONT;
  
  // Whitespace
  CHAR_FLAGS[32] |= FLAG_WHITESPACE;  // space
  CHAR_FLAGS[9] |= FLAG_WHITESPACE;   // tab
  CHAR_FLAGS[10] |= FLAG_WHITESPACE;  // newline
  CHAR_FLAGS[13] |= FLAG_WHITESPACE;  // carriage return
}
```

## Key Algorithms

### 1. Whitespace and Comment Skipping
**Location**: [`lexer.ts:skipWhitespaceAndComments()`](../../src/lexer/lexer.ts)

```typescript
private skipWhitespaceAndComments(preserveTrivia: boolean = false): Token[] {
  const trivia: Token[] = [];
  
  while (!this.isAtEnd()) {
    const char = this.peek();
    const code = char.charCodeAt(0);
    
    // Check whitespace using character flags
    if (code < 128 && (CHAR_FLAGS[code] & FLAG_WHITESPACE)) {
      const start = this.savePosition();
      const ws = this.scanWhitespace();
      if (preserveTrivia) {
        trivia.push(this.makeToken(TokenType.WS, ws, start, Channel.HIDDEN));
      }
    } else if (char === '/' && this.peekNext() === '/') {
      // Single-line comment
      this.advance(); // /
      this.advance(); // /
      let comment = '//';
      while (!this.isAtEnd() && this.peek() !== '\n') {
        comment += this.advance();
      }
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
```

Handles both whitespace and comments, optionally preserving them as trivia tokens.

### 2. Identifier Scanning
**Location**: [`lexer.ts:scanIdentifier()`](../../src/lexer/lexer.ts)

```typescript
private scanIdentifier(): string {
  const start = this.position;
  
  while (!this.isAtEnd()) {
    const char = this.peek();
    const code = char.charCodeAt(0);
    
    if (code < 128) {
      if ((CHAR_FLAGS[code] & FLAG_IDENTIFIER_CONT) === 0) break;
    } else {
      // Handle non-ASCII Unicode letters/digits
      if (!this.isUnicodeIdentifierCont(char)) break;
    }
    
    this.advance();
  }
  
  return this.chars.slice(start, this.position).join('');
}
```

The identifier scanner uses character flags for ASCII characters and falls back to Unicode checks for non-ASCII characters.

### 3. Number Scanning
**Location**: [`lexer.ts:scanNumber()`](../../src/lexer/lexer.ts)

Handles integers and decimals following FHIRPath number format:

```typescript
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
```

Numbers can have leading zeros and optional decimal parts.

### 4. String Scanning
**Location**: [`lexer.ts:scanString()`](../../src/lexer/lexer.ts)

Handles string literals with escape sequences:

```typescript
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
```

Strings use single quotes and support standard escape sequences including Unicode escapes.

## Performance Optimizations

### 1. Object Pooling
**Location**: [`lexer.ts`](../../src/lexer/lexer.ts)

The lexer uses an object pool to reuse token objects:

```typescript
class TokenPool {
  private pool: Token[] = [];
  private poolIndex: number = 0;
  
  getToken(type: TokenType, value: string, position: Position): Token {
    if (this.poolIndex < this.pool.length) {
      const token = this.pool[this.poolIndex++];
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
```

### 2. String Interning
**Location**: [`lexer.ts`](../../src/lexer/lexer.ts)

Common strings are interned to reduce memory usage:

```typescript
// String interning for common tokens
private readonly internedStrings = new Map<string, string>();

constructor(input: string) {
  this.chars = Array.from(input);
  this.length = this.chars.length;
  
  // Pre-intern common strings
  const common = ['true', 'false', 'and', 'or', 'where', 'select', 'exists'];
  for (const str of common) {
    this.internedStrings.set(str, str);
  }
}
```

### 3. Character Tables
Using pre-computed tables eliminates regex overhead for common character classifications, providing O(1) lookups for ASCII characters.

## Error Handling

The lexer provides detailed error information:

```typescript
export class LexerError extends Error {
  constructor(
    message: string,
    public position: number,
    public line: number,
    public column: number
  ) {
    super(message);
  }
}
```

Errors include:
- Unterminated strings
- Invalid number formats
- Unexpected characters
- Invalid escape sequences

## Usage Example

```typescript
import { FHIRPathLexer, lex } from './lexer/lexer';

const expression = "Patient.name.given.first()";
const lexer = new FHIRPathLexer(expression);
const tokens = lexer.tokenize();

// Or use convenience function
const tokens2 = lex(expression);

// Results in:
// [
//   { type: 'IDENTIFIER', value: 'Patient', position: { line: 1, column: 1, offset: 0 } },
//   { type: 'DOT', value: '.', position: { line: 1, column: 8, offset: 7 } },
//   { type: 'IDENTIFIER', value: 'name', position: { line: 1, column: 9, offset: 8 } },
//   { type: 'DOT', value: '.', position: { line: 1, column: 13, offset: 12 } },
//   { type: 'IDENTIFIER', value: 'given', position: { line: 1, column: 14, offset: 13 } },
//   { type: 'DOT', value: '.', position: { line: 1, column: 19, offset: 18 } },
//   { type: 'IDENTIFIER', value: 'first', position: { line: 1, column: 20, offset: 19 } },
//   { type: 'LPAREN', value: '(', position: { line: 1, column: 25, offset: 24 } },
//   { type: 'RPAREN', value: ')', position: { line: 1, column: 26, offset: 25 } },
//   { type: 'EOF', value: '', position: { line: 1, column: 27, offset: 26 } }
// ]
```

## Integration with Parser

The lexer produces tokens that are consumed by the parser. The token stream includes:
- Token type for syntactic analysis
- Token value for semantic processing
- Position information for error reporting
- EOF token to signal end of input

The parser can request tokens one at a time or process the entire token array, depending on the parsing strategy.