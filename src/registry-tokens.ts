/**
 * Token definitions that can be used by both lexer and registry
 * This creates a single source of truth for all tokens
 */

export interface TokenDefinition {
  name: string;
  value: number;
  category: 'literal' | 'identifier' | 'operator' | 'keyword' | 'delimiter' | 'special';
}

// Auto-generate token values
let tokenCounter = 0;
const nextToken = () => tokenCounter++;

// Define all tokens with metadata
export const TOKEN_DEFINITIONS: Record<string, TokenDefinition> = {
  // Literals
  NULL: { name: 'NULL', value: nextToken(), category: 'literal' },
  BOOLEAN: { name: 'BOOLEAN', value: nextToken(), category: 'literal' },
  STRING: { name: 'STRING', value: nextToken(), category: 'literal' },
  NUMBER: { name: 'NUMBER', value: nextToken(), category: 'literal' },
  DATETIME: { name: 'DATETIME', value: nextToken(), category: 'literal' },
  TIME: { name: 'TIME', value: nextToken(), category: 'literal' },
  
  // Identifiers
  IDENTIFIER: { name: 'IDENTIFIER', value: nextToken(), category: 'identifier' },
  DELIMITED_IDENTIFIER: { name: 'DELIMITED_IDENTIFIER', value: nextToken(), category: 'identifier' },
  
  // Keywords
  TRUE: { name: 'TRUE', value: nextToken(), category: 'keyword' },
  FALSE: { name: 'FALSE', value: nextToken(), category: 'keyword' },
  
  // Special identifiers
  THIS: { name: 'THIS', value: nextToken(), category: 'special' },
  INDEX: { name: 'INDEX', value: nextToken(), category: 'special' },
  TOTAL: { name: 'TOTAL', value: nextToken(), category: 'special' },
  ENV_VAR: { name: 'ENV_VAR', value: nextToken(), category: 'special' },
  
  // Date/time units
  YEAR: { name: 'YEAR', value: nextToken(), category: 'keyword' },
  MONTH: { name: 'MONTH', value: nextToken(), category: 'keyword' },
  WEEK: { name: 'WEEK', value: nextToken(), category: 'keyword' },
  DAY: { name: 'DAY', value: nextToken(), category: 'keyword' },
  HOUR: { name: 'HOUR', value: nextToken(), category: 'keyword' },
  MINUTE: { name: 'MINUTE', value: nextToken(), category: 'keyword' },
  SECOND: { name: 'SECOND', value: nextToken(), category: 'keyword' },
  MILLISECOND: { name: 'MILLISECOND', value: nextToken(), category: 'keyword' },
  YEARS: { name: 'YEARS', value: nextToken(), category: 'keyword' },
  MONTHS: { name: 'MONTHS', value: nextToken(), category: 'keyword' },
  WEEKS: { name: 'WEEKS', value: nextToken(), category: 'keyword' },
  DAYS: { name: 'DAYS', value: nextToken(), category: 'keyword' },
  HOURS: { name: 'HOURS', value: nextToken(), category: 'keyword' },
  MINUTES: { name: 'MINUTES', value: nextToken(), category: 'keyword' },
  SECONDS: { name: 'SECONDS', value: nextToken(), category: 'keyword' },
  MILLISECONDS: { name: 'MILLISECONDS', value: nextToken(), category: 'keyword' },
  
  // Delimiters
  DOT: { name: 'DOT', value: nextToken(), category: 'delimiter' },
  LPAREN: { name: 'LPAREN', value: nextToken(), category: 'delimiter' },
  RPAREN: { name: 'RPAREN', value: nextToken(), category: 'delimiter' },
  LBRACKET: { name: 'LBRACKET', value: nextToken(), category: 'delimiter' },
  RBRACKET: { name: 'RBRACKET', value: nextToken(), category: 'delimiter' },
  LBRACE: { name: 'LBRACE', value: nextToken(), category: 'delimiter' },
  RBRACE: { name: 'RBRACE', value: nextToken(), category: 'delimiter' },
  COMMA: { name: 'COMMA', value: nextToken(), category: 'delimiter' },
  PERCENT: { name: 'PERCENT', value: nextToken(), category: 'delimiter' },
  AT: { name: 'AT', value: nextToken(), category: 'delimiter' },
  
  // Special
  EOF: { name: 'EOF', value: nextToken(), category: 'special' },
  WHITESPACE: { name: 'WHITESPACE', value: nextToken(), category: 'special' },
  COMMENT: { name: 'COMMENT', value: nextToken(), category: 'special' },
  LINE_COMMENT: { name: 'LINE_COMMENT', value: nextToken(), category: 'special' },
};

// Create enum-like object for TokenType
export const TokenType = Object.fromEntries(
  Object.entries(TOKEN_DEFINITIONS).map(([key, def]) => [key, def.value])
) as { [K in keyof typeof TOKEN_DEFINITIONS]: number };

// Type for TokenType values
export type TokenTypeValue = typeof TokenType[keyof typeof TokenType];

// Helper to get token name
export function getTokenName(tokenType: TokenTypeValue): string {
  for (const [key, def] of Object.entries(TOKEN_DEFINITIONS)) {
    if (def.value === tokenType) {
      return key;
    }
  }
  return `UNKNOWN(${tokenType})`;
}