/**
 * Utility functions for handling decimal precision in FHIRPath
 */

/**
 * Get the number of decimal places in a number
 */
export function getDecimalPlaces(n: number): number {
  if (Number.isInteger(n)) {
    return 0;
  }
  
  // Convert to string and count decimal places
  // Use toFixed(10) then strip trailing zeros to get actual precision
  const str = n.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
  const decimalIndex = str.indexOf('.');
  
  if (decimalIndex === -1) {
    return 0;
  }
  
  return str.length - decimalIndex - 1;
}

/**
 * Round a number to a specific number of decimal places
 */
export function roundToDecimalPlaces(n: number, places: number): number {
  if (places < 0) {
    throw new Error('Decimal places must be non-negative');
  }
  
  const multiplier = Math.pow(10, places);
  return Math.round(n * multiplier) / multiplier;
}

/**
 * Normalize a decimal result based on the precision of the operands
 * According to FHIRPath spec, arithmetic operations should preserve
 * the appropriate precision based on the input values
 */
export function normalizeDecimalResult(result: number, leftOperand: number, rightOperand: number): number {
  // If result is effectively an integer, return it as is
  if (Number.isInteger(result)) {
    return result;
  }
  
  // Get the precision of both operands
  const leftPlaces = getDecimalPlaces(leftOperand);
  const rightPlaces = getDecimalPlaces(rightOperand);
  
  // For addition and subtraction, use the maximum precision
  // For multiplication, sum the precisions
  // For division and modulo, use a reasonable precision (8 decimal places max)
  const maxPrecision = Math.max(leftPlaces, rightPlaces);
  
  // Round to the appropriate precision to eliminate floating point artifacts
  return roundToDecimalPlaces(result, Math.min(maxPrecision, 8));
}

/**
 * Normalize a decimal for modulo operation
 * Modulo has special precision rules
 */
export function normalizeModuloResult(result: number, leftOperand: number, rightOperand: number): number {
  // If result is effectively an integer, return it as is
  if (Number.isInteger(result)) {
    return result;
  }
  
  // For modulo, use the precision of the divisor (right operand)
  const rightPlaces = getDecimalPlaces(rightOperand);
  
  // Round to the appropriate precision
  return roundToDecimalPlaces(result, Math.min(rightPlaces, 8));
}