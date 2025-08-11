import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { subtractQuantities } from '../quantity-value';
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
    const result = subtractQuantities(l as QuantityValue, r as QuantityValue);
    return { value: result ? [box(result, { type: 'Quantity', singleton: true })] : [], context };
  }
  
  // Handle numeric subtraction
  if (typeof l === 'number' && typeof r === 'number') {
    return { value: [box(l - r, { type: 'Any', singleton: true })], context };
  }
  
  // For other types, return empty
  return { value: [], context };
};

export const minusOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '-',
  name: 'minus',
  category: ['arithmetic'],
  precedence: PRECEDENCE.ADDITIVE,
  associativity: 'left',
  description: 'Subtracts the right operand from the left operand (supported for Integer, Decimal, and Quantity). For Date/DateTime/Time, decrements by time-valued quantity.',
  examples: ['5 - 3', '10.5 - 2.5', '3 \'m\' - 3 \'cm\'', '@2019-03-01 - 24 months'],
  signatures: [
    {
      name: 'integer-minus',
      left: { type: 'Integer', singleton: true },
      right: { type: 'Integer', singleton: true },
      result: { type: 'Integer', singleton: true },
    },
    {
      name: 'decimal-minus',
      left: { type: 'Decimal', singleton: true },
      right: { type: 'Decimal', singleton: true },
      result: { type: 'Decimal', singleton: true },
    },
    {
      name: 'quantity-minus',
      left: { type: 'Quantity', singleton: true },
      right: { type: 'Quantity', singleton: true },
      result: { type: 'Quantity', singleton: true },
    },
    {
      name: 'date-minus',
      left: { type: 'Date', singleton: true },
      right: { type: 'Quantity', singleton: true },
      result: { type: 'Date', singleton: true },
    },
    {
      name: 'datetime-minus',
      left: { type: 'DateTime', singleton: true },
      right: { type: 'Quantity', singleton: true },
      result: { type: 'DateTime', singleton: true },
    },
    {
      name: 'time-minus',
      left: { type: 'Time', singleton: true },
      right: { type: 'Quantity', singleton: true },
      result: { type: 'Time', singleton: true },
    }
  ],
  evaluate
};