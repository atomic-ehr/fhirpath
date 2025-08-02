import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { divideQuantities } from '../quantity-value';
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
    const result = divideQuantities(l as QuantityValue, r as QuantityValue);
    return { value: result ? [result] : [], context };
  }
  
  // Handle quantity / number
  if (l && typeof l === 'object' && 'unit' in l && typeof r === 'number') {
    if (r === 0) {
      return { value: [], context };
    }
    const q = l as QuantityValue;
    return { value: [{ value: q.value / r, unit: q.unit }], context };
  }
  
  // Handle numeric division
  if (typeof l === 'number' && typeof r === 'number') {
    if (r === 0) {
      return { value: [], context };
    }
    return { value: [l / r], context };
  }
  
  // For other types, return empty
  return { value: [], context };
};

export const divideOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '/',
  name: 'divide',
  category: ['arithmetic'],
  precedence: PRECEDENCE.MULTIPLICATIVE,
  associativity: 'left',
  description: 'Divides the left operand by the right operand (supported for Integer, Decimal, and Quantity). The result is always Decimal, even if inputs are both Integer. Division by zero returns empty.',
  examples: ['10 / 2', '7.5 / 1.5', '12 \'cm2\' / 3 \'cm\'', '12 / 0'],
  signatures: [
    {
      name: 'integer-divide',
      left: { type: 'Integer', singleton: true },
      right: { type: 'Integer', singleton: true },
      result: { type: 'Decimal', singleton: true },
    },
    {
      name: 'decimal-divide',
      left: { type: 'Decimal', singleton: true },
      right: { type: 'Decimal', singleton: true },
      result: { type: 'Decimal', singleton: true },
    },
    {
      name: 'quantity-divide',
      left: { type: 'Quantity', singleton: true },
      right: { type: 'Quantity', singleton: true },
      result: { type: 'Quantity', singleton: true },
    }
  ],
  evaluate
};