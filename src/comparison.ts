import type { FHIRPathValue } from './boxing';
import { unbox } from './boxing';
import type { QuantityValue } from './quantity-value';
import { compareQuantities } from './quantity-value';
import type { TemporalValue } from './temporal';
import { equals as temporalEquals, compare as temporalCompare, isFHIRDate, isFHIRDateTime, isFHIRTime } from './temporal';

/**
 * Result of comparing two values
 */
export type ComparisonResult = 
  | { kind: 'equal' }
  | { kind: 'less' }
  | { kind: 'greater' }
  | { kind: 'incomparable'; reason?: string };

/**
 * Compare two FHIRPath values
 * Returns a ComparisonResult indicating the relationship between the values
 */
export function compare(a: unknown, b: unknown): ComparisonResult {
  // Early exit: reference equality
  if (a === b) {
    return { kind: 'equal' };
  }
  
  // Handle null/undefined
  if (a === null || a === undefined || b === null || b === undefined) {
    return { kind: 'incomparable', reason: 'null or undefined value' };
  }
  
  // Early exit: type mismatch for primitives
  const typeA = typeof a;
  const typeB = typeof b;
  if (typeA !== typeB && typeA !== 'object' && typeB !== 'object') {
    return { kind: 'incomparable', reason: 'type mismatch' };
  }

  // Check if values are temporal types
  if (isTemporalValue(a) && isTemporalValue(b)) {
    return compareTemporal(a, b);
  }

  // Check if values are quantities
  if (isQuantity(a) && isQuantity(b)) {
    return compareQuantityValues(a, b);
  }

  // Handle mixed quantity and number comparison
  if (isQuantity(a) && typeof b === 'number') {
    return compareQuantityToNumber(a, b);
  }
  if (typeof a === 'number' && isQuantity(b)) {
    const result = compareQuantityToNumber(b, a);
    // Flip the comparison result
    if (result.kind === 'less') return { kind: 'greater' };
    if (result.kind === 'greater') return { kind: 'less' };
    return result;
  }

  // Check if values are complex types (objects/arrays)
  if (isComplex(a) && isComplex(b)) {
    return compareComplex(a, b);
  }

  // Primitive comparison
  return comparePrimitive(a, b);
}

/**
 * Compare collections (arrays of values)
 * Collections are compared element-by-element in order
 */
export function compareCollections(left: FHIRPathValue[], right: FHIRPathValue[]): ComparisonResult {
  // Empty collections
  if (left.length === 0 || right.length === 0) {
    return { kind: 'incomparable', reason: 'empty collection' };
  }

  // Single value collections
  if (left.length === 1 && right.length === 1) {
    const leftItem = left[0];
    const rightItem = right[0];
    if (!leftItem || !rightItem) {
      return { kind: 'incomparable', reason: 'undefined element in collection' };
    }
    const leftValue = unbox(leftItem);
    const rightValue = unbox(rightItem);
    return compare(leftValue, rightValue);
  }

  // Multiple value collections - must be same length for comparison
  if (left.length !== right.length) {
    // For ordering comparison, different lengths are incomparable
    // But the helper functions handle equality specially
    return { kind: 'incomparable', reason: 'different collection lengths' };
  }

  // Compare element by element
  for (let i = 0; i < left.length; i++) {
    const leftItem = left[i];
    const rightItem = right[i];
    if (!leftItem || !rightItem) {
      return { kind: 'incomparable', reason: 'undefined element in collection' };
    }
    const leftValue = unbox(leftItem);
    const rightValue = unbox(rightItem);
    const result = compare(leftValue, rightValue);
    
    if (result.kind !== 'equal') {
      // First non-equal element determines the result
      return result;
    }
  }

  return { kind: 'equal' };
}

/**
 * Check if collections are equal
 */
export function collectionsEqual(left: FHIRPathValue[], right: FHIRPathValue[]): boolean | null {
  // Early exit: reference equality
  if (left === right) {
    return true;
  }
  
  // Empty collections return null (incomparable)
  if (left.length === 0 || right.length === 0) {
    return null;
  }
  
  // Early exit: different lengths are definitively not equal
  if (left.length !== right.length) {
    return false;
  }
  
  // Compare elements
  const result = compareCollections(left, right);
  if (result.kind === 'incomparable') {
    // Special case: if the reason is "complex types not equal", we know they're not equal
    if (result.reason === 'complex types not equal') {
      return false;
    }
    return null;
  }
  return result.kind === 'equal';
}

/**
 * Check if collections are not equal
 */
export function collectionsNotEqual(left: FHIRPathValue[], right: FHIRPathValue[]): boolean | null {
  // Early exit: reference equality means definitely equal (so not not-equal)
  if (left === right && left.length > 0) {
    return false;
  }
  
  // Empty collections return null (incomparable)
  if (left.length === 0 || right.length === 0) {
    return null;
  }
  
  // Early exit: different lengths are definitively not equal
  if (left.length !== right.length) {
    return true;
  }
  
  // Compare elements
  const result = compareCollections(left, right);
  if (result.kind === 'incomparable') {
    // Special case: if the reason is "complex types not equal", we know they're not equal
    if (result.reason === 'complex types not equal') {
      return true;
    }
    return null;
  }
  return result.kind !== 'equal';
}

// Type guards
function isTemporalValue(value: unknown): value is TemporalValue {
  if (!value || typeof value !== 'object') return false;
  const v = value as any;
  return isFHIRDate(v) || isFHIRDateTime(v) || isFHIRTime(v);
}

function isQuantity(value: unknown): value is QuantityValue {
  if (!value || typeof value !== 'object') return false;
  const v = value as any;
  return 'unit' in v && 'value' in v && typeof v.value === 'number' && typeof v.unit === 'string';
}

function isComplex(value: unknown): value is object {
  return value !== null && typeof value === 'object' && !isTemporalValue(value) && !isQuantity(value);
}

// Type-specific comparison functions

function compareTemporal(a: TemporalValue, b: TemporalValue): ComparisonResult {
  // Use existing temporal comparison logic
  const compareResult = temporalCompare(a, b);
  
  if (compareResult === null) {
    return { kind: 'incomparable', reason: 'incomparable temporal values' };
  }
  if (compareResult === 0) {
    return { kind: 'equal' };
  }
  if (compareResult < 0) {
    return { kind: 'less' };
  }
  return { kind: 'greater' };
}

function compareQuantityValues(a: QuantityValue, b: QuantityValue): ComparisonResult {
  const result = compareQuantities(a, b);
  
  if (result === null) {
    return { kind: 'incomparable', reason: 'incompatible quantity dimensions' };
  }
  if (result === 0) {
    return { kind: 'equal' };
  }
  if (result < 0) {
    return { kind: 'less' };
  }
  return { kind: 'greater' };
}

function compareQuantityToNumber(quantity: QuantityValue, number: number): ComparisonResult {
  // Dimensionless quantities can be compared to numbers
  if (quantity.unit === '1' || quantity.unit === '') {
    if (quantity.value === number) {
      return { kind: 'equal' };
    }
    if (quantity.value < number) {
      return { kind: 'less' };
    }
    return { kind: 'greater' };
  }
  // Non-dimensionless quantity cannot be compared to a number
  return { kind: 'incomparable', reason: 'cannot compare dimensioned quantity to number' };
}

function compareComplex(a: any, b: any): ComparisonResult {
  // Use deep equality for complex types
  if (deepEqual(a, b)) {
    return { kind: 'equal' };
  }
  // Complex types are not orderable, so we can't say less or greater
  // But for equality purposes, we know they're not equal
  return { kind: 'incomparable', reason: 'complex types not equal' };
}

function comparePrimitive(a: unknown, b: unknown): ComparisonResult {
  // String comparison
  if (typeof a === 'string' && typeof b === 'string') {
    if (a === b) return { kind: 'equal' };
    if (a < b) return { kind: 'less' };
    return { kind: 'greater' };
  }

  // Number comparison
  if (typeof a === 'number' && typeof b === 'number') {
    if (a === b) return { kind: 'equal' };
    if (a < b) return { kind: 'less' };
    return { kind: 'greater' };
  }

  // Boolean comparison
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    if (a === b) return { kind: 'equal' };
    // false < true in FHIRPath
    if (!a && b) return { kind: 'less' };
    return { kind: 'greater' };
  }

  // Type mismatch
  if (typeof a !== typeof b) {
    return { kind: 'incomparable', reason: 'type mismatch' };
  }

  // Fallback to strict equality
  if (a === b) {
    return { kind: 'equal' };
  }
  return { kind: 'incomparable', reason: 'incomparable values' };
}

/**
 * Deep equality comparison for complex types
 * Handles arrays, objects, and nested structures
 */
export function deepEqual(a: any, b: any): boolean {
  // Early exit: same reference
  if (a === b) return true;

  // Early exit: different types
  const typeA = typeof a;
  const typeB = typeof b;
  if (typeA !== typeB) return false;
  
  // Early exit: primitives
  if (typeA !== 'object') return false; // We already checked a === b
  
  // Null or undefined
  if (a == null || b == null) return a === b;

  // Arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  // Objects
  if (typeof a === 'object' && typeof b === 'object') {
    // Special handling for temporal and quantity types
    if (isTemporalValue(a) && isTemporalValue(b)) {
      return temporalEquals(a, b) === true;
    }
    if (isQuantity(a) && isQuantity(b)) {
      return compareQuantities(a, b) === 0;
    }

    // General object comparison
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  // Primitives
  return a === b;
}

// Performance optimization: Caching for repeated comparisons
const comparisonCache = new WeakMap<any, WeakMap<any, ComparisonResult>>();

/**
 * Compare with caching for performance
 * Uses WeakMap to avoid memory leaks and automatically clean up when objects are garbage collected
 */
export function compareWithCache(a: unknown, b: unknown): ComparisonResult {
  // Only cache object comparisons (primitives are fast enough)
  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    let aCache = comparisonCache.get(a);
    if (aCache) {
      const cached = aCache.get(b);
      if (cached) return cached;
    } else {
      aCache = new WeakMap();
      comparisonCache.set(a, aCache);
    }
    
    const result = compare(a, b);
    aCache.set(b, result);
    return result;
  }
  
  return compare(a, b);
}