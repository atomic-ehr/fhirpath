import type { Token } from '../lexer/token';
import { TokenType } from '../lexer/token';
import { Registry } from '../registry';

/**
 * Manages operator precedence for the parser
 */
export class PrecedenceManager {
  /**
   * Get precedence for a token
   * Higher number = higher precedence
   */
  static getPrecedence(token: Token): number {
    // Special case for DOT which might not be in registry yet
    if (token.type === TokenType.DOT) return 13;
    
    // Use registry directly - both now use standard convention
    return Registry.getPrecedence(token.type);
  }

  /**
   * Check if an operator is right-associative
   */
  static isRightAssociative(op: Token): boolean {
    // FHIRPath doesn't have right-associative operators
    return false;
  }

  /**
   * Get associativity adjustment for parsing
   * For left-associative operators, we parse right side with precedence + 1
   * For right-associative operators, we parse with same precedence
   */
  static getAssociativityAdjustment(op: Token): number {
    return this.isRightAssociative(op) ? 0 : 1;
  }

  /**
   * Check if precedence allows continuation of expression parsing
   */
  static shouldContinueParsing(tokenPrecedence: number, minPrecedence: number): boolean {
    return tokenPrecedence !== 0 && tokenPrecedence >= minPrecedence;
  }

  /**
   * Standard precedence levels for reference
   */
  static readonly PRECEDENCE_LEVELS = {
    NONE: 0,
    IMPLIES: 1,         // implies - lowest precedence
    OR: 2,              // or, xor
    AND: 3,             // and
    MEMBERSHIP: 4,      // in, contains
    EQUALITY: 5,        // =, ~, !=, !~
    RELATIONAL: 6,      // <, >, <=, >=
    UNION: 7,           // |
    TYPE: 8,            // is, as
    ADDITIVE: 9,        // +, -, &
    MULTIPLICATIVE: 10, // *, /, div, mod
    UNARY: 11,          // unary +, -, not
    POSTFIX: 12,        // [] indexing
    INVOCATION: 13      // . (dot), function calls - highest precedence
  };
}