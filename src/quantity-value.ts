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
 * Calendar duration units used in FHIRPath
 * These are NOT UCUM units and should not be converted
 */
export const CALENDAR_DURATION_UNITS = new Set([
  'year', 'years',
  'month', 'months',
  'week', 'weeks',
  'day', 'days',
  'hour', 'hours',
  'minute', 'minutes',
  'second', 'seconds',
  'millisecond', 'milliseconds'
]);

/**
 * Create a quantity value
 */
export function createQuantity(value: number, unit: string): QuantityValue {
  return {
    value,
    unit
  };
}

/**
 * Get or create the UCUM quantity for a QuantityValue
 */
export function getUcumQuantity(quantity: QuantityValue): Quantity | null {
  // Calendar duration units are not UCUM units
  if (CALENDAR_DURATION_UNITS.has(quantity.unit)) {
    return null;
  }
  
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
 * Valid units are either UCUM units or calendar duration units
 */
export function isValidQuantity(quantity: QuantityValue): boolean {
  // Calendar duration units are valid FHIRPath quantities
  if (CALENDAR_DURATION_UNITS.has(quantity.unit)) {
    return true;
  }
  // Otherwise check if it's a valid UCUM unit
  return getUcumQuantity(quantity) !== null;
}

/**
 * Add two quantities
 */
export function addQuantities(left: QuantityValue, right: QuantityValue): QuantityValue | null {
  // Special case: adding calendar durations with the same unit
  if (CALENDAR_DURATION_UNITS.has(left.unit) && left.unit === right.unit) {
    return {
      value: left.value + right.value,
      unit: left.unit
    };
  }
  
  // Different calendar units cannot be added
  if (CALENDAR_DURATION_UNITS.has(left.unit) || CALENDAR_DURATION_UNITS.has(right.unit)) {
    return null;
  }
  
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
  // Special case: subtracting calendar durations with the same unit
  if (CALENDAR_DURATION_UNITS.has(left.unit) && left.unit === right.unit) {
    return {
      value: left.value - right.value,
      unit: left.unit
    };
  }
  
  // Different calendar units cannot be subtracted
  if (CALENDAR_DURATION_UNITS.has(left.unit) || CALENDAR_DURATION_UNITS.has(right.unit)) {
    return null;
  }
  
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
  // Special case: multiplying calendar duration by a dimensionless number
  // e.g., 1 year * 2 = 2 years, or 2 * 1 year = 2 years
  if (CALENDAR_DURATION_UNITS.has(left.unit) && right.unit === '1') {
    // Calendar duration * number
    return {
      value: left.value * right.value,
      unit: left.unit
    };
  }
  if (CALENDAR_DURATION_UNITS.has(right.unit) && left.unit === '1') {
    // Number * calendar duration
    return {
      value: left.value * right.value,
      unit: right.unit
    };
  }
  
  // Check if both are calendar duration units - this is not allowed
  if (CALENDAR_DURATION_UNITS.has(left.unit) && CALENDAR_DURATION_UNITS.has(right.unit)) {
    // Calendar duration units cannot be multiplied together - the result would be meaningless
    throw new Error(`Cannot multiply calendar duration units: ${left.unit} * ${right.unit}`);
  }
  
  // Mixed calendar and non-calendar units are not allowed
  if (CALENDAR_DURATION_UNITS.has(left.unit) || CALENDAR_DURATION_UNITS.has(right.unit)) {
    throw new Error(`Cannot multiply calendar duration with non-calendar units: ${left.unit} * ${right.unit}`);
  }
  
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
  // Special case: dividing calendar duration by a dimensionless number
  // e.g., 10 months / 2 = 5 months
  if (CALENDAR_DURATION_UNITS.has(left.unit) && right.unit === '1') {
    // Calendar duration / number
    return {
      value: left.value / right.value,
      unit: left.unit
    };
  }
  
  // Division of number by calendar duration is not allowed
  // Division of two calendar durations is not allowed
  if (CALENDAR_DURATION_UNITS.has(left.unit) || CALENDAR_DURATION_UNITS.has(right.unit)) {
    // Calendar duration units cannot be divided except by dimensionless numbers
    throw new Error(`Cannot divide calendar duration units: ${left.unit} / ${right.unit}`);
  }
  
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
  // Special case: comparing calendar durations with the same unit
  if (CALENDAR_DURATION_UNITS.has(left.unit) && left.unit === right.unit) {
    if (left.value < right.value) {
      return -1;
    } else if (left.value > right.value) {
      return 1;
    } else {
      return 0;
    }
  }
  
  // Different calendar units cannot be compared
  if (CALENDAR_DURATION_UNITS.has(left.unit) || CALENDAR_DURATION_UNITS.has(right.unit)) {
    return null;
  }
  
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