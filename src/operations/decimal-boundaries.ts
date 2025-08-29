/**
 * Decimal boundary functions for FHIRPath
 * 
 * Implements lowBoundary and highBoundary for decimal values according to the FHIRPath specification.
 * These functions return the least or greatest possible value at a specified precision.
 */

/**
 * Maximum supported precision for decimal values (FHIRPath requires at least 8)
 */
const MAX_DECIMAL_PRECISION = 8;

/**
 * Get the low boundary of a decimal value at the specified precision
 * 
 * Returns the least possible value of the input to the specified precision.
 * For the given precision, returns the truncated value minus half the step size.
 * 
 * @param value The decimal value
 * @param precision The number of decimal places (optional, defaults to input precision + 1)  
 * @returns The low boundary value, or null if precision is invalid
 */
export function getDecimalLowBoundary(value: number, precision?: number): number | null {
  // Default precision is the input's precision (for decimals) or 1 (for integers)
  if (precision === undefined) {
    const str = value.toString();
    const decimalIndex = str.indexOf('.');
    const inputPrecision = decimalIndex === -1 ? 0 : str.length - decimalIndex - 1;
    // For integers, default to precision 1; for decimals, use their precision
    precision = inputPrecision === 0 ? 1 : Math.min(inputPrecision, MAX_DECIMAL_PRECISION);
  }
  
  // Invalid precision returns null (empty in FHIRPath)
  if (precision < 0 || precision > MAX_DECIMAL_PRECISION) {
    return null;
  }
  
  // For precision 0 (integer precision)
  if (precision === 0) {
    // For integers at precision 0, return floor - 1 for positive, ceiling + 1 for negative
    // 1.lowBoundary(0) = 0
    // -1.lowBoundary(0) = -2
    const truncated = value >= 0 ? Math.floor(value) : Math.ceil(value);
    return truncated - 1;
  }
  
  // Calculate the factor for the given precision
  const factor = Math.pow(10, precision);
  const stepSize = Math.pow(10, -precision);
  const halfStep = stepSize / 2;
  
  // Check if the original value is an integer
  const isInteger = Math.floor(value) === value;
  
  // For integers with decimal precision, the boundary is 0.5 less than the value
  if (isInteger && precision > 0) {
    return value - 0.5;
  }
  
  // Truncate the value to the specified precision using floor (always toward negative infinity)
  const truncated = Math.floor(value * factor) / factor;
  
  // The low boundary is the truncated value minus half a step
  return truncated - halfStep;
}

/**
 * Get the high boundary of a decimal value at the specified precision
 * 
 * Returns the greatest possible value of the input to the specified precision.
 * For the given precision, returns the ceiling value plus half the step size.
 * 
 * @param value The decimal value
 * @param precision The number of decimal places (optional, defaults to input precision + 1)
 * @returns The high boundary value, or null if precision is invalid
 */
export function getDecimalHighBoundary(value: number, precision?: number): number | null {
  // Default precision is the input's precision (for decimals) or 1 (for integers)
  if (precision === undefined) {
    const str = value.toString();
    const decimalIndex = str.indexOf('.');
    const inputPrecision = decimalIndex === -1 ? 0 : str.length - decimalIndex - 1;
    // For integers, default to precision 1; for decimals, use their precision
    precision = inputPrecision === 0 ? 1 : Math.min(inputPrecision, MAX_DECIMAL_PRECISION);
  }
  
  // Invalid precision returns null (empty in FHIRPath)
  if (precision < 0 || precision > MAX_DECIMAL_PRECISION) {
    return null;
  }
  
  // For precision 0 (integer precision)
  if (precision === 0) {
    // For integers at precision 0, return ceiling + 1 for positive, floor - 1 for negative
    // 1.highBoundary(0) = 2
    // -1.highBoundary(0) = -2
    const ceiling = value >= 0 ? Math.ceil(value) : Math.floor(value);
    return ceiling + 1;
  }
  
  // Calculate the factor for the given precision
  const factor = Math.pow(10, precision);
  const stepSize = Math.pow(10, -precision);
  const halfStep = stepSize / 2;
  
  // Check if the original value is an integer
  const isInteger = Math.floor(value) === value;
  
  // For integers with decimal precision, the boundary is 0.5 more than the value
  if (isInteger && precision > 0) {
    return value + 0.5;
  }
  
  // Ceiling the value to the specified precision (always toward positive infinity)
  const ceiling = Math.ceil(value * factor) / factor;
  
  // The high boundary is the ceiling value plus half a step
  return ceiling + halfStep;
}

/**
 * Format a decimal value to a specific number of decimal places
 * Ensures trailing zeros are preserved in the output string
 */
export function formatDecimalWithPrecision(value: number, precision: number): string {
  // Handle special case for precision 0
  if (precision === 0) {
    return String(Math.round(value));
  }
  
  // Use toFixed to ensure the right number of decimal places
  return value.toFixed(precision);
}