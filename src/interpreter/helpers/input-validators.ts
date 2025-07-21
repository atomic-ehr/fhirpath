import { CollectionUtils, EvaluationError } from '../types';

/**
 * Input validation helpers for FHIRPath functions
 * These helpers standardize input validation and empty handling
 */

export class InputValidators {
  /**
   * Require input to be a non-empty string
   */
  static requireStringInput(input: any[], functionName: string): string {
    if (input.length === 0) {
      throw new EvaluationError(`${functionName}() requires a string input`);
    }
    
    const value = CollectionUtils.toSingleton(input);
    if (typeof value !== 'string') {
      throw new EvaluationError(`${functionName}() requires a string input`);
    }
    
    return value;
  }

  /**
   * Require input to be a non-empty number
   */
  static requireNumberInput(input: any[], functionName: string): number {
    if (input.length === 0) {
      throw new EvaluationError(`${functionName}() requires a number input`);
    }
    
    const value = CollectionUtils.toSingleton(input);
    if (typeof value !== 'number') {
      throw new EvaluationError(`${functionName}() requires a number input`);
    }
    
    return value;
  }

  /**
   * Require input to be a non-empty boolean
   */
  static requireBooleanInput(input: any[], functionName: string): boolean {
    if (input.length === 0) {
      throw new EvaluationError(`${functionName}() requires a boolean input`);
    }
    
    const value = CollectionUtils.toSingleton(input);
    if (typeof value !== 'boolean') {
      throw new EvaluationError(`${functionName}() requires a boolean input`);
    }
    
    return value;
  }

  /**
   * Require input to be non-empty
   */
  static requireNonEmptyInput(input: any[], functionName: string): any[] {
    if (input.length === 0) {
      throw new EvaluationError(`${functionName}() requires non-empty input`);
    }
    
    return input;
  }

  /**
   * Handle empty input gracefully with early return
   */
  static handleEmptyInput<T>(input: any[], defaultValue: T): { isEmpty: true, value: T } | { isEmpty: false } {
    if (input.length === 0) {
      return { isEmpty: true, value: defaultValue };
    }
    
    return { isEmpty: false };
  }

  /**
   * Get singleton value or return undefined if not a singleton
   */
  static getSingleton(input: any[]): any | undefined {
    if (input.length === 1) {
      return input[0];
    }
    return undefined;
  }

  /**
   * Try to get singleton value, throw if multiple values
   */
  static requireSingleton(input: any[], functionName: string): any {
    if (input.length === 0) {
      throw new EvaluationError(`${functionName}() requires non-empty input`);
    }
    
    if (input.length > 1) {
      throw new EvaluationError(`${functionName}() requires single value input`);
    }
    
    return input[0];
  }
}