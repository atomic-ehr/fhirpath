import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { multiplyQuantities } from '../quantity-value';
import type { QuantityValue } from '../quantity-value';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  if (left.length === 0 || right.length === 0) {
    return { value: [], context };
  }
  
  const l = left[0];
  const r = right[0];
  
  // Check if both are quantities
  if (l && typeof l === 'object' && 'unit' in l && 
      r && typeof r === 'object' && 'unit' in r) {
    const result = multiplyQuantities(l as QuantityValue, r as QuantityValue);
    return { value: result ? [result] : [], context };
  }
  
  // Handle quantity * number
  if (l && typeof l === 'object' && 'unit' in l && typeof r === 'number') {
    const q = l as QuantityValue;
    return { value: [{ value: q.value * r, unit: q.unit }], context };
  }
  
  // Handle number * quantity
  if (typeof l === 'number' && r && typeof r === 'object' && 'unit' in r) {
    const q = r as QuantityValue;
    return { value: [{ value: l * q.value, unit: q.unit }], context };
  }
  
  // Handle numeric multiplication
  if (typeof l === 'number' && typeof r === 'number') {
    return { value: [l * r], context };
  }
  
  // For other types, return empty
  return { value: [], context };
};

export const multiplyOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '*',
  name: 'multiply',
  category: ['arithmetic'],
  precedence: PRECEDENCE.MULTIPLICATIVE,
  associativity: 'left',
  description: 'Multiplies both arguments (supported for Integer, Decimal, and Quantity). For multiplication involving quantities, the resulting quantity will have the appropriate unit',
  examples: ['2 * 3', '5.5 * 2', '12 \'cm\' * 3 \'cm\'', '3 \'cm\' * 12 \'cm2\''],
  signatures: [
    {
      name: 'integer-multiply',
      left: { type: 'Integer', singleton: true },
      right: { type: 'Integer', singleton: true },
      result: { type: 'Integer', singleton: true },
    },
    {
      name: 'decimal-multiply',
      left: { type: 'Decimal', singleton: true },
      right: { type: 'Decimal', singleton: true },
      result: { type: 'Decimal', singleton: true },
    },
    {
      name: 'quantity-multiply',
      left: { type: 'Quantity', singleton: true },
      right: { type: 'Quantity', singleton: true },
      result: { type: 'Quantity', singleton: true },
    }
  ],
  evaluate
};