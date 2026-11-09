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

const TEN = BigInt(10);
const ZERO = BigInt(0);

// Exact decimal digits of a finite number (shortest round-trip form) as an integer and a scale
function toScaled(n: number): { digits: bigint; scale: number } {
  const [mantissa = '0', exponent = '0'] = String(n).split('e');
  const [whole = '0', fraction = ''] = mantissa.split('.');
  const scale = fraction.length - Number(exponent);
  const digits = BigInt(whole + fraction);
  return scale >= 0 ? { digits, scale } : { digits: digits * TEN ** BigInt(-scale), scale: 0 };
}

function fromScaled(digits: bigint, scale: number): number {
  if (scale === 0) {
    return Number(digits);
  }
  const abs = (digits < ZERO ? -digits : digits).toString().padStart(scale + 1, '0');
  return Number(`${digits < ZERO ? '-' : ''}${abs.slice(0, -scale)}.${abs.slice(-scale)}`);
}

/**
 * Truncated division (quotient rounded toward zero) and its remainder (sign of the dividend),
 * computed exactly on the decimal values instead of their binary approximations,
 * e.g. 0.3 mod 0.1 = 0 and 0.3 div 0.1 = 3. The divisor must be non-zero.
 */
export function truncatedDivMod(left: number, right: number): { quotient: number; remainder: number } {
  const a = toScaled(left);
  const b = toScaled(right);
  const scale = Math.max(a.scale, b.scale);
  const dividend = a.digits * TEN ** BigInt(scale - a.scale);
  const divisor = b.digits * TEN ** BigInt(scale - b.scale);
  return { quotient: Number(dividend / divisor), remainder: fromScaled(dividend % divisor, scale) };
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export type NumericTypeName = 'Integer' | 'Long' | 'Decimal';

/**
 * Result type of an arithmetic operation: the type of the operands after implicit
 * conversion (Integer -> Long -> Decimal). Falls back to the value when the type is unknown.
 */
export function numericResultType(
  left: { type?: string; value: number },
  right: { type?: string; value: number }
): NumericTypeName {
  const typeOf = ({ type, value }: { type?: string; value: number }): NumericTypeName =>
    type === 'Integer' || type === 'Long' || type === 'Decimal' ? type : Number.isInteger(value) ? 'Integer' : 'Decimal';
  const types = [typeOf(left), typeOf(right)];
  return types.includes('Decimal') ? 'Decimal' : types.includes('Long') ? 'Long' : 'Integer';
}