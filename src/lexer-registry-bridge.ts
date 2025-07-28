import { TokenType } from './lexer';
import { Registry } from './registry';

/**
 * Helper to extract precedence from token type using the encoded format
 * TokenType enum encodes precedence as 0xPPXX where PP is precedence in hex
 */
export function extractPrecedenceFromToken(tokenType: TokenType): number {
  // Extract precedence from the encoded token value
  const precedence = (tokenType >> 8) & 0xFF;
  return precedence > 0 ? precedence : -1;
}

/**
 * Get precedence from registry, falling back to encoded value if not found
 */
export function getTokenPrecedence(tokenType: TokenType, registry: Registry): number {
  // First try to get from registry
  const registryPrecedence = registry.getPrecedence(tokenType);
  if (registryPrecedence >= 0) {
    return registryPrecedence;
  }
  
  // Fall back to encoded precedence
  return extractPrecedenceFromToken(tokenType);
}

/**
 * Map of keyword strings to token types
 * This could be generated from the registry in the future
 */
export const keywordTokenMap = new Map<string, TokenType>([
  ['true', TokenType.TRUE],
  ['false', TokenType.FALSE],
  ['as', TokenType.AS],
  ['is', TokenType.IS],
  ['in', TokenType.IN],
  ['contains', TokenType.CONTAINS],
  ['div', TokenType.DIV],
  ['mod', TokenType.MOD],
  ['and', TokenType.AND],
  ['or', TokenType.OR],
  ['xor', TokenType.XOR],
  ['implies', TokenType.IMPLIES],
  // Date/time units
  ['year', TokenType.YEAR],
  ['years', TokenType.YEARS],
  ['month', TokenType.MONTH],
  ['months', TokenType.MONTHS],
  ['week', TokenType.WEEK],
  ['weeks', TokenType.WEEKS],
  ['day', TokenType.DAY],
  ['days', TokenType.DAYS],
  ['hour', TokenType.HOUR],
  ['hours', TokenType.HOURS],
  ['minute', TokenType.MINUTE],
  ['minutes', TokenType.MINUTES],
  ['second', TokenType.SECOND],
  ['seconds', TokenType.SECONDS],
  ['millisecond', TokenType.MILLISECOND],
  ['milliseconds', TokenType.MILLISECONDS],
]);

/**
 * Check if a keyword is a known FHIRPath keyword
 */
export function isKeyword(text: string): boolean {
  return keywordTokenMap.has(text.toLowerCase());
}

/**
 * Get the token type for a keyword
 */
export function getKeywordToken(text: string): TokenType | undefined {
  return keywordTokenMap.get(text.toLowerCase());
}