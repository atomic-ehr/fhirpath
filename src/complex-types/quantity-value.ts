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
 * Calendar to UCUM duration mappings
 * Maps FHIRPath calendar duration units to their UCUM equivalents
 */
export const CALENDAR_TO_UCUM: Record<string, string> = {
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
  // Handle calendar to UCUM comparisons
  const leftIsCalendar = CALENDAR_DURATION_UNITS.has(left.unit);
  const rightIsCalendar = CALENDAR_DURATION_UNITS.has(right.unit);
  
  // Both calendar units - only compare if they're compatible units
  if (leftIsCalendar && rightIsCalendar) {
    // Only allow conversion between specific compatible units
    const areCompatible = (unit1: string, unit2: string): boolean => {
      // Normalize to singular form
      const normalize = (u: string) => u.endsWith('s') ? u.slice(0, -1) : u;
      const n1 = normalize(unit1);
      const n2 = normalize(unit2);
      
      // Same unit (singular/plural)
      if (n1 === n2) return true;
      
      // Week <-> days conversion
      if ((n1 === 'week' && n2 === 'day') || (n1 === 'day' && n2 === 'week')) return true;
      
      // No other conversions between calendar units
      return false;
    };
    
    if (!areCompatible(left.unit, right.unit)) {
      // Different calendar units that aren't compatible
      return null;
    }
    
    // Handle week/day conversion
    const normalizeToSingular = (u: string) => u.endsWith('s') ? u.slice(0, -1) : u;
    const leftNorm = normalizeToSingular(left.unit);
    const rightNorm = normalizeToSingular(right.unit);
    
    if (leftNorm === rightNorm) {
      // Same unit, just compare values
      if (left.value < right.value) return -1;
      if (left.value > right.value) return 1;
      return 0;
    }
    
    // Week <-> day conversion
    if ((leftNorm === 'week' && rightNorm === 'day') || 
        (leftNorm === 'day' && rightNorm === 'week')) {
      const leftInDays = leftNorm === 'week' ? left.value * 7 : left.value;
      const rightInDays = rightNorm === 'week' ? right.value * 7 : right.value;
      
      if (leftInDays < rightInDays) return -1;
      if (leftInDays > rightInDays) return 1;
      return 0;
    }
    
    // Shouldn't reach here
    return null;
  }
  
  // Calendar to UCUM comparison
  if (leftIsCalendar && !rightIsCalendar) {
    // Check for week/day special case
    if ((left.unit === 'days' || left.unit === 'day') && right.unit === 'wk') {
      // Convert days to weeks
      const leftInWeeks = left.value / 7;
      if (leftInWeeks < right.value) return -1;
      if (leftInWeeks > right.value) return 1;
      return 0;
    }
    if ((left.unit === 'weeks' || left.unit === 'week') && right.unit === 'd') {
      // Convert weeks to days
      const leftInDays = left.value * 7;
      if (leftInDays < right.value) return -1;
      if (leftInDays > right.value) return 1;
      return 0;
    }
    
    // Direct mapping check
    const leftUcumUnit = CALENDAR_TO_UCUM[left.unit];
    if (leftUcumUnit === right.unit) {
      // Direct mapping, compare values
      if (left.value < right.value) return -1;
      if (left.value > right.value) return 1;
      return 0;
    }
    // No mapping, incomparable
    return null;
  }
  
  // UCUM to calendar comparison
  if (!leftIsCalendar && rightIsCalendar) {
    // Check for week/day special case
    if (left.unit === 'wk' && (right.unit === 'days' || right.unit === 'day')) {
      // Convert weeks to days
      const leftInDays = left.value * 7;
      if (leftInDays < right.value) return -1;
      if (leftInDays > right.value) return 1;
      return 0;
    }
    if (left.unit === 'd' && (right.unit === 'weeks' || right.unit === 'week')) {
      // Convert days to weeks
      const leftInWeeks = left.value / 7;
      if (leftInWeeks < right.value) return -1;
      if (leftInWeeks > right.value) return 1;
      return 0;
    }
    
    // Direct mapping check
    const rightUcumUnit = CALENDAR_TO_UCUM[right.unit];
    if (left.unit === rightUcumUnit) {
      // Direct mapping, compare values
      if (left.value < right.value) return -1;
      if (left.value > right.value) return 1;
      return 0;
    }
    // No mapping, incomparable
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