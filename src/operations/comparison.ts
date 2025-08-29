import type { FHIRPathValue } from '../interpreter/boxing';
import { unbox } from '../interpreter/boxing';
import type { QuantityValue } from '../complex-types/quantity-value';
import { compareQuantities } from '../complex-types/quantity-value';
import type { TemporalValue } from '../complex-types/temporal';
import { equals as temporalEquals, compare as temporalCompare, isFHIRDate, isFHIRDateTime, isFHIRTime } from '../complex-types/temporal';

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

// ============================================================================
// Equivalence Implementation
// ============================================================================

/**
 * Check if two values are equivalent according to FHIRPath semantics
 * Equivalence is more permissive than equality:
 * - Strings are compared case-insensitively with normalized whitespace
 * - Decimals ignore trailing zeros (2.0 ~ 2.00)
 * - Quantities use UCUM semantic equivalence
 * - Collections are compared without considering order
 * - null/empty are considered equivalent
 */
export function equivalent(a: unknown, b: unknown): boolean | null {
  // Handle null/empty equivalence
  if (isEmpty(a) && isEmpty(b)) return true;
  if (isEmpty(a) || isEmpty(b)) return false;
  
  // String equivalence - case insensitive, normalized whitespace
  if (typeof a === 'string' && typeof b === 'string') {
    return stringEquivalent(a, b);
  }
  
  // Number/Decimal equivalence - semantic value comparison
  if (typeof a === 'number' && typeof b === 'number') {
    return decimalEquivalent(a, b);
  }
  
  // Quantity equivalence
  if (isQuantity(a) && isQuantity(b)) {
    return quantityEquivalent(a, b);
  }
  
  // Temporal types use equality semantics
  // But for equivalence, incomparable (null) means not equivalent (false)
  if (isTemporalValue(a) && isTemporalValue(b)) {
    const result = temporalEquals(a, b);
    // If temporal values are incomparable (different precision), they're not equivalent
    return result === null ? false : result;
  }
  
  // Boolean equivalence is same as equality
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return a === b;
  }
  
  // Complex types need deep equivalence
  if (isComplex(a) && isComplex(b)) {
    return deepEquivalent(a, b);
  }
  
  // Type mismatch
  if (typeof a !== typeof b) {
    return false;
  }
  
  // Default to strict equality
  return a === b;
}

/**
 * Check if a value is empty (null, undefined, or empty array/object)
 */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value).length === 0) return true;
  return false;
}

/**
 * String equivalence with case-insensitive comparison and whitespace normalization
 */
function stringEquivalent(a: string, b: string): boolean {
  // Normalize whitespace: collapse multiple spaces, trim ends
  const normalize = (s: string) => 
    s.replace(/\s+/g, ' ').trim().toLowerCase();
  
  return normalize(a) === normalize(b);
}

/**
 * Decimal equivalence for FHIRPath
 * 
 * Per spec: "comparison is done on values rounded to the precision of the 
 * least precise operand. Trailing zeroes after the decimal are ignored in 
 * determining precision."
 * 
 * Since JavaScript loses literal precision (1.0 becomes 1), we deduce precision:
 * - Numbers with no fractional part (1, 2.0 -> 2) have 0 decimal places
 * - Numbers with fractional parts use their actual decimal places
 */
function decimalEquivalent(a: number, b: number): boolean {
  // Handle special cases
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  
  // Infinite values must match exactly
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return a === b;
  }
  
  // Deduce precision from the numeric values
  const aPrecision = getDecimalPrecision(a);
  const bPrecision = getDecimalPrecision(b);
  
  // Round both to the minimum precision
  const minPrecision = Math.min(aPrecision, bPrecision);
  
  // Round both numbers to the minimum precision
  const factor = Math.pow(10, minPrecision);
  const aRounded = Math.round(a * factor) / factor;
  const bRounded = Math.round(b * factor) / factor;
  
  return aRounded === bRounded;
}

/**
 * Get the effective decimal precision of a number.
 * Numbers with no fractional part (like 1.0 which becomes 1) have 0 precision.
 * Numbers with fractional parts have precision based on significant decimal places.
 */
function getDecimalPrecision(n: number): number {
  // If it's effectively an integer (no fractional part), precision is 0
  if (Number.isInteger(n)) {
    return 0;
  }
  
  // Convert to string to count decimal places
  // Use a reasonable maximum precision to avoid floating point artifacts
  const str = n.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  const decimalIndex = str.indexOf('.');
  
  if (decimalIndex === -1) {
    return 0;
  }
  
  return str.length - decimalIndex - 1;
}

// Calendar to UCUM duration mappings for equivalence
const CALENDAR_TO_UCUM_MAP: Record<string, string> = {
  'year': 'a',
  'years': 'a',
  'month': 'mo',
  'months': 'mo',
  'week': 'wk',
  'weeks': 'wk',
  'day': 'd',
  'days': 'd',
  'hour': 'h',
  'hours': 'h',
  'minute': 'min',
  'minutes': 'min',
  'second': 's',
  'seconds': 's',
  'millisecond': 'ms',
  'milliseconds': 'ms'
};

/**
 * Quantity equivalence with UCUM semantic comparison and calendar mappings
 */
function quantityEquivalent(a: QuantityValue, b: QuantityValue): boolean | null {
  // Check for calendar to UCUM equivalence
  const aIsCalendar = CALENDAR_TO_UCUM_MAP[a.unit] !== undefined;
  const bIsCalendar = CALENDAR_TO_UCUM_MAP[b.unit] !== undefined;
  
  // Calendar to UCUM mapping
  if (aIsCalendar && !bIsCalendar) {
    const ucumUnit = CALENDAR_TO_UCUM_MAP[a.unit];
    return ucumUnit === b.unit && a.value === b.value;
  }
  if (!aIsCalendar && bIsCalendar) {
    const ucumUnit = CALENDAR_TO_UCUM_MAP[b.unit];
    return ucumUnit === a.unit && a.value === b.value;
  }
  
  // Both calendar units - must be same unit and value
  if (aIsCalendar && bIsCalendar) {
    // Normalize to singular/plural
    const aNorm = CALENDAR_TO_UCUM_MAP[a.unit];
    const bNorm = CALENDAR_TO_UCUM_MAP[b.unit];
    return aNorm === bNorm && a.value === b.value;
  }
  
  // Standard UCUM semantic equivalence (1000 mg ~ 1 g)
  const result = compareQuantities(a, b);
  return result === 0;
}

/**
 * Deep equivalence for complex objects
 * Similar to deep equality but uses equivalence rules for nested values
 */
function deepEquivalent(a: any, b: any): boolean {
  // Early exit: same reference
  if (a === b) return true;
  
  // Arrays - compare elements using equivalence
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const equiv = equivalent(a[i], b[i]);
      if (equiv !== true) return false;
    }
    return true;
  }
  
  // Objects - compare properties using equivalence
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      const equiv = equivalent(a[key], b[key]);
      if (equiv !== true) return false;
    }
    return true;
  }
  
  return false;
}

/**
 * Compare collections for equivalence
 * Collections are equivalent if they contain the same elements regardless of order
 */
export function collectionsEquivalent(left: FHIRPathValue[], right: FHIRPathValue[]): boolean | null {
  // Empty collections are equivalent
  if (left.length === 0 && right.length === 0) return true;
  
  // One empty, one not - not equivalent
  if (left.length === 0 || right.length === 0) return false;
  
  // Different lengths = not equivalent
  if (left.length !== right.length) return false;
  
  // Single element collections
  if (left.length === 1 && right.length === 1) {
    const leftValue = unbox(left[0]!);
    const rightValue = unbox(right[0]!);
    return equivalent(leftValue, rightValue);
  }
  
  // Sort both collections for comparison
  // We need a stable sort that groups equivalent elements together
  const sortedLeft = [...left].sort((a, b) => sortCompareForEquivalence(unbox(a), unbox(b)));
  const sortedRight = [...right].sort((a, b) => sortCompareForEquivalence(unbox(a), unbox(b)));
  
  // Compare sorted elements using equivalence
  for (let i = 0; i < sortedLeft.length; i++) {
    const leftValue = unbox(sortedLeft[i]!);
    const rightValue = unbox(sortedRight[i]!);
    const equiv = equivalent(leftValue, rightValue);
    
    if (equiv === null) return null;
    if (equiv === false) return false;
  }
  
  return true;
}

/**
 * Compare collections for non-equivalence
 */
export function collectionsNotEquivalent(left: FHIRPathValue[], right: FHIRPathValue[]): boolean | null {
  const result = collectionsEquivalent(left, right);
  if (result === null) return null;
  return !result;
}

/**
 * Comparison function for sorting collections for equivalence comparison
 * Groups equivalent items together
 */
function sortCompareForEquivalence(a: unknown, b: unknown): number {
  // Handle null/undefined
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1;
  if (b === null || b === undefined) return 1;
  
  // Type-based ordering
  const typeOrder = ['boolean', 'number', 'string', 'object'];
  const typeA = typeof a;
  const typeB = typeof b;
  const orderA = typeOrder.indexOf(typeA);
  const orderB = typeOrder.indexOf(typeB);
  
  if (orderA !== orderB) {
    return orderA - orderB;
  }
  
  // Same type comparison
  switch (typeA) {
    case 'boolean':
      return (a as boolean) === (b as boolean) ? 0 : (a as boolean) ? 1 : -1;
    
    case 'number':
      return (a as number) - (b as number);
    
    case 'string':
      // Use normalized comparison for sorting
      const aNorm = (a as string).toLowerCase().trim();
      const bNorm = (b as string).toLowerCase().trim();
      return aNorm < bNorm ? -1 : aNorm > bNorm ? 1 : 0;
    
    case 'object':
      // For objects, use a stable stringification
      // This is not perfect but works for sorting purposes
      const aStr = JSON.stringify(a);
      const bStr = JSON.stringify(b);
      return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
    
    default:
      return 0;
  }
}