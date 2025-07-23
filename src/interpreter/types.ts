// Core types for FHIRPath interpreter following the stream-processing mental model

/**
 * The result of evaluating any FHIRPath expression.
 * Every expression returns a collection and potentially modified context.
 */
export interface EvaluationResult {
  value: any[];  // Always a collection (even single values are collections of one)
  context: Context;
}

/**
 * Context carries variables and environment data parallel to the data stream.
 * It flows through expressions and can be modified by certain operations.
 * 
 * Uses JavaScript prototype chain for efficient inheritance.
 */
export interface Context {
  // User-defined variables (%varName)
  // Using Record instead of Map for prototype chain compatibility
  variables: Record<string, any[]>;
  
  // Special environment variables
  env: {
    $this?: any[];    // Current item in iterator functions
    $index?: number;  // Current index in iterator functions
    $total?: any[];   // Accumulator in aggregate function
  };
  
  // Root context variables
  $context?: any[];      // Original input to the expression
  $resource?: any[];     // Current resource being processed
  $rootResource?: any[]; // Top-level resource
}

/**
 * Error thrown during evaluation with position information
 */
export class EvaluationError extends Error {
  constructor(
    message: string,
    public position?: { line: number; column: number; offset: number }
  ) {
    super(message);
    this.name = 'EvaluationError';
  }
}

/**
 * Type information for runtime type checking
 */
export interface TypeInfo {
  namespace: string;  // 'System' or 'FHIR'
  name: string;       // Type name like 'String', 'Patient'
  isCollection?: boolean;
}

/**
 * Helper type for ensuring we always work with collections
 */
export type Collection<T = any> = T[];

/**
 * Singleton conversion result
 */
export type SingletonResult<T = any> = T | undefined;

/**
 * Helper functions for working with collections
 */
export const CollectionUtils = {
  /**
   * Convert any value to a collection
   */
  toCollection(value: any): any[] {
    if (value === null || value === undefined) {
      return [];
    }
    return Array.isArray(value) ? value : [value];
  },

  /**
   * Apply singleton evaluation rules
   * @returns The single value or undefined if rules don't apply
   * @throws Error if multiple items when single expected
   */
  toSingleton(collection: any[], expectedType?: string): SingletonResult {
    if (collection.length === 0) {
      return undefined; // Empty propagates
    }
    
    if (collection.length === 1) {
      const value = collection[0];
      
      // Rule 2: Collection with one item, expecting Boolean → true
      if (expectedType === 'boolean' && typeof value !== 'boolean') {
        return true;
      }
      
      // Rule 1: Collection with one item convertible to expected type → use it
      return value;
    }
    
    // Rule 4: Multiple items → ERROR
    throw new EvaluationError(`Expected single value but got ${collection.length} items`);
  },

  /**
   * Check if a collection is empty
   */
  isEmpty(collection: any[]): boolean {
    return collection.length === 0;
  },

  /**
   * Flatten nested collections
   */
  flatten(collection: any[]): any[] {
    const result: any[] = [];
    for (const item of collection) {
      if (Array.isArray(item)) {
        result.push(...item);
      } else {
        result.push(item);
      }
    }
    return result;
  }
};