import { TokenType } from '../lexer/token';
import { CollectionUtils, EvaluationError } from './types';

/**
 * Binary operator implementations following FHIRPath semantics
 */
export class Operators {
  /**
   * Apply arithmetic operator with singleton conversion
   */
  static arithmetic(
    operator: TokenType,
    left: any[],
    right: any[]
  ): any[] {
    // Empty propagates
    if (left.length === 0 || right.length === 0) {
      return [];
    }

    // Apply singleton conversion
    const leftValue = CollectionUtils.toSingleton(left);
    const rightValue = CollectionUtils.toSingleton(right);

    // Check types
    if (typeof leftValue !== 'number' || typeof rightValue !== 'number') {
      throw new EvaluationError(`Arithmetic operations require numbers`);
    }

    let result: number;
    switch (operator) {
      case TokenType.PLUS:
        result = leftValue + rightValue;
        break;
      case TokenType.MINUS:
        result = leftValue - rightValue;
        break;
      case TokenType.STAR:
        result = leftValue * rightValue;
        break;
      case TokenType.SLASH:
        result = leftValue / rightValue;
        break;
      case TokenType.DIV:
        result = Math.floor(leftValue / rightValue);
        break;
      case TokenType.MOD:
        result = leftValue % rightValue;
        break;
      default:
        throw new EvaluationError(`Unknown arithmetic operator: ${operator}`);
    }

    return [result];
  }

  /**
   * Apply comparison operator with FHIRPath semantics
   */
  static comparison(
    operator: TokenType,
    left: any[],
    right: any[]
  ): any[] {
    // For equality/inequality, use special collection handling
    if (operator === TokenType.EQ) {
      return this.collectionEquals(left, right);
    }
    if (operator === TokenType.NEQ) {
      const eqResult = this.collectionEquals(left, right);
      return eqResult.length === 0 ? [] : [!eqResult[0]];
    }

    // For other comparisons, use singleton conversion
    // Empty collections in comparisons return empty (three-valued logic)
    if (left.length === 0 || right.length === 0) {
      return [];
    }

    // Apply singleton conversion
    const leftValue = CollectionUtils.toSingleton(left);
    const rightValue = CollectionUtils.toSingleton(right);

    let result: boolean;
    switch (operator) {
      case TokenType.LT:
        result = this.compare(leftValue, rightValue) < 0;
        break;
      case TokenType.GT:
        result = this.compare(leftValue, rightValue) > 0;
        break;
      case TokenType.LTE:
        result = this.compare(leftValue, rightValue) <= 0;
        break;
      case TokenType.GTE:
        result = this.compare(leftValue, rightValue) >= 0;
        break;
      default:
        throw new EvaluationError(`Unknown comparison operator: ${operator}`);
    }

    return [result];
  }

  /**
   * Apply logical operator with three-valued logic
   */
  static logical(
    operator: TokenType,
    left: any[],
    right?: any[]
  ): any[] {
    switch (operator) {
      case TokenType.AND:
        return this.and(left, right!);
      case TokenType.OR:
        return this.or(left, right!);
      case TokenType.NOT:
        return this.not(left);
      case TokenType.XOR:
        return this.xor(left, right!);
      case TokenType.IMPLIES:
        return this.implies(left, right!);
      default:
        throw new EvaluationError(`Unknown logical operator: ${operator}`);
    }
  }

  /**
   * Three-valued AND logic
   */
  private static and(left: any[], right: any[]): any[] {
    // Convert to boolean if needed
    const leftBool = this.toBoolean(left);
    const rightBool = this.toBoolean(right);

    // false and anything → false
    if (leftBool === false || rightBool === false) {
      return [false];
    }

    // true and true → true
    if (leftBool === true && rightBool === true) {
      return [true];
    }

    // Otherwise unknown (empty)
    return [];
  }

  /**
   * Three-valued OR logic
   */
  private static or(left: any[], right: any[]): any[] {
    // Convert to boolean if needed
    const leftBool = this.toBoolean(left);
    const rightBool = this.toBoolean(right);

    // true or anything → true
    if (leftBool === true || rightBool === true) {
      return [true];
    }

    // false or false → false
    if (leftBool === false && rightBool === false) {
      return [false];
    }

    // Otherwise unknown (empty)
    return [];
  }

  /**
   * Three-valued NOT logic
   */
  private static not(operand: any[]): any[] {
    const bool = this.toBoolean(operand);
    
    if (bool === true) return [false];
    if (bool === false) return [true];
    
    // Unknown → unknown
    return [];
  }

  /**
   * Three-valued XOR logic
   */
  private static xor(left: any[], right: any[]): any[] {
    const leftBool = this.toBoolean(left);
    const rightBool = this.toBoolean(right);

    // If either is unknown, result is unknown
    if (leftBool === undefined || rightBool === undefined) {
      return [];
    }

    return [leftBool !== rightBool];
  }

  /**
   * Three-valued IMPLIES logic
   */
  private static implies(left: any[], right: any[]): any[] {
    const leftBool = this.toBoolean(left);
    const rightBool = this.toBoolean(right);

    // false implies anything → true
    if (leftBool === false) {
      return [true];
    }

    // true implies true → true
    if (leftBool === true && rightBool === true) {
      return [true];
    }

    // true implies false → false
    if (leftBool === true && rightBool === false) {
      return [false];
    }

    // Otherwise unknown
    return [];
  }

  /**
   * Convert collection to boolean for three-valued logic
   * @returns true, false, or undefined (unknown)
   */
  private static toBoolean(collection: any[]): boolean | undefined {
    if (collection.length === 0) {
      return undefined; // Unknown
    }

    const value = CollectionUtils.toSingleton(collection, 'boolean');
    
    // Already boolean
    if (typeof value === 'boolean') {
      return value;
    }

    // Non-empty collection → true
    return true;
  }

  /**
   * FHIRPath equality comparison
   */
  private static equals(a: any, b: any): boolean {
    // Handle null/undefined
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;

    // Array comparison (for collections)
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this.equals(a[i], b[i])) return false;
      }
      return true;
    }

    // Same type comparison
    if (typeof a === typeof b) {
      return a === b;
    }

    // Type mismatch
    return false;
  }

  /**
   * Collection equality with singleton conversion
   * Used for = operator when comparing collections
   */
  static collectionEquals(left: any[], right: any[]): any[] {
    // Empty collections in comparisons return empty (three-valued logic)
    if (left.length === 0 || right.length === 0) {
      return [];
    }

    // If both are single-item collections, compare the items
    if (left.length === 1 && right.length === 1) {
      return [this.equals(left[0], right[0])];
    }

    // For multi-item collections, they must be exactly equal
    return [this.equals(left, right)];
  }

  /**
   * FHIRPath ordering comparison
   * @returns -1 if a < b, 0 if a = b, 1 if a > b
   */
  private static compare(a: any, b: any): number {
    // Numbers
    if (typeof a === 'number' && typeof b === 'number') {
      return a < b ? -1 : a > b ? 1 : 0;
    }

    // Strings
    if (typeof a === 'string' && typeof b === 'string') {
      return a < b ? -1 : a > b ? 1 : 0;
    }

    // Type mismatch - not comparable
    throw new EvaluationError(`Cannot compare ${typeof a} with ${typeof b}`);
  }
}