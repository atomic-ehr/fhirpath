import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { divideQuantities } from '../quantity-value';
import type { QuantityValue } from '../quantity-value';
import { box, unbox } from '../boxing';

export const evaluate: OperationEvaluator = async (input, context, left, right) => {
  if (left.length === 0 || right.length === 0) {
    return { value: [], context };
  }
  
  const boxedl = left[0];
  if (!boxedl) return { value: [], context };
  const l = unbox(boxedl);
  const boxedr = right[0];
  if (!boxedr) return { value: [], context };
  const r = unbox(boxedr);
  
  // Check if both are quantities
  if (l && typeof l === 'object' && 'unit' in l && 
      r && typeof r === 'object' && 'unit' in r) {
    const result = divideQuantities(l as QuantityValue, r as QuantityValue);
    return { value: result ? [box(result, { type: 'Quantity', singleton: true })] : [], context };
  }
  
  // Handle quantity / number
  if (l && typeof l === 'object' && 'unit' in l && typeof r === 'number') {
    if (r === 0) {
      return { value: [], context };
    }
    const q = l as QuantityValue;
    return { value: [box({ value: q.value / r, unit: q.unit }, { type: 'Quantity', singleton: true })], context };
  }
  
  // Handle numeric division
  if (typeof l === 'number' && typeof r === 'number') {
    if (r === 0) {
      return { value: [], context };
    }
    return { value: [box(l / r, { type: 'Any', singleton: true })], context };
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