import { ucum } from '@atomic-ehr/ucum';
import type { Quantity } from '@atomic-ehr/ucum';

/**
 * Wrapper for FHIRPath quantity values with UCUM integration
 */
export interface QuantityValue {
  value: number;
  unit: string;
  _ucumQuantity?: Quantity; // Lazy-initialized
}

/**
 * Calendar duration unit to UCUM unit mapping
 */
export const CALENDAR_TO_UCUM: Record<string, string> = {
  'year': 'a',      // annum
  'years': 'a',
  'month': 'mo',    // month
  'months': 'mo',
  'week': 'wk',     // week
  'weeks': 'wk',
  'day': 'd',       // day
  'days': 'd',
  'hour': 'h',      // hour
  'hours': 'h',
  'minute': 'min',  // minute
  'minutes': 'min',
  'second': 's',    // second
  'seconds': 's',
  'millisecond': 'ms', // millisecond
  'milliseconds': 'ms'
};

/**
 * Create a quantity value
 */
export function createQuantity(value: number, unit: string, isCalendarUnit: boolean = false): QuantityValue {
  const actualUnit = isCalendarUnit && CALENDAR_TO_UCUM[unit] ? CALENDAR_TO_UCUM[unit] : unit;
  return {
    value,
    unit: actualUnit
  };
}

/**
 * Get or create the UCUM quantity for a QuantityValue
 */
export function getUcumQuantity(quantity: QuantityValue): Quantity | null {
  if (!quantity._ucumQuantity) {
    try {
      quantity._ucumQuantity = ucum.quantity(quantity.value, quantity.unit);
    } catch (e) {
      // Invalid unit - return null
      return null;
    }
  }
  return quantity._ucumQuantity || null;
}

/**
 * Check if a quantity has a valid unit
 */
export function isValidQuantity(quantity: QuantityValue): boolean {
  return getUcumQuantity(quantity) !== null;
}

/**
 * Add two quantities
 */
export function addQuantities(left: QuantityValue, right: QuantityValue): QuantityValue | null {
  const leftUcum = getUcumQuantity(left);
  const rightUcum = getUcumQuantity(right);
  
  if (!leftUcum || !rightUcum) {
    return null;
  }
  
  try {
    const result = ucum.add(leftUcum, rightUcum);
    return {
      value: result.value,
      unit: result.unit
    };
  } catch (e) {
    // Incompatible dimensions
    return null;
  }
}

/**
 * Subtract two quantities
 */
export function subtractQuantities(left: QuantityValue, right: QuantityValue): QuantityValue | null {
  const leftUcum = getUcumQuantity(left);
  const rightUcum = getUcumQuantity(right);
  
  if (!leftUcum || !rightUcum) {
    return null;
  }
  
  try {
    const result = ucum.subtract(leftUcum, rightUcum);
    return {
      value: result.value,
      unit: result.unit
    };
  } catch (e) {
    // Incompatible dimensions
    return null;
  }
}

/**
 * Multiply two quantities
 */
export function multiplyQuantities(left: QuantityValue, right: QuantityValue): QuantityValue | null {
  const leftUcum = getUcumQuantity(left);
  const rightUcum = getUcumQuantity(right);
  
  if (!leftUcum || !rightUcum) {
    return null;
  }
  
  try {
    const result = ucum.multiply(leftUcum, rightUcum);
    return {
      value: result.value,
      unit: result.unit
    };
  } catch (e) {
    return null;
  }
}

/**
 * Divide two quantities
 */
export function divideQuantities(left: QuantityValue, right: QuantityValue): QuantityValue | null {
  const leftUcum = getUcumQuantity(left);
  const rightUcum = getUcumQuantity(right);
  
  if (!leftUcum || !rightUcum) {
    return null;
  }
  
  try {
    const result = ucum.divide(leftUcum, rightUcum);
    return {
      value: result.value,
      unit: result.unit
    };
  } catch (e) {
    return null;
  }
}

/**
 * Compare two quantities
 * Returns -1 if left < right, 0 if equal, 1 if left > right, null if incomparable
 */
export function compareQuantities(left: QuantityValue, right: QuantityValue): number | null {
  const leftUcum = getUcumQuantity(left);
  const rightUcum = getUcumQuantity(right);
  
  if (!leftUcum || !rightUcum) {
    return null;
  }
  
  try {
    // Try to convert right to left's unit for comparison
    const rightValue = ucum.convert(rightUcum.value, rightUcum.unit, leftUcum.unit);
    if (leftUcum.value < rightValue) {
      return -1;
    } else if (leftUcum.value > rightValue) {
      return 1;
    } else {
      return 0;
    }
  } catch (e) {
    // Incompatible dimensions
    return null;
  }
}

/**
 * Check if two quantities are equal
 */
export function equalQuantities(left: QuantityValue, right: QuantityValue): boolean {
  return compareQuantities(left, right) === 0;
}

/**
 * Convert quantity to string representation
 */
export function quantityToString(quantity: QuantityValue): string {
  return `${quantity.value} '${quantity.unit}'`;
}