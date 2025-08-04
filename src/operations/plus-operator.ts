import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { addQuantities } from '../quantity-value';
import type { QuantityValue } from '../quantity-value';
import { box, unbox } from '../boxing';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  if (left.length === 0 || right.length === 0) {
    return { value: [], context };
  }
  
  const boxedL = left[0];
  const boxedR = right[0];
  
  if (!boxedL || !boxedR) {
    return { value: [], context };
  }
  
  const l = unbox(boxedL);
  const r = unbox(boxedR);
  
  // Check if both are quantities
  if (l && typeof l === 'object' && 'unit' in l && 
      r && typeof r === 'object' && 'unit' in r) {
    const result = addQuantities(l as QuantityValue, r as QuantityValue);
    return { value: result ? [box(result, { type: 'Quantity', singleton: true })] : [], context };
  }
  
  if (typeof l === 'string' || typeof r === 'string') {
    return { value: [box(String(l) + String(r), { type: 'String', singleton: true })], context };
  }
  
  if (typeof l === 'number' && typeof r === 'number') {
    const result = l + r;
    const typeInfo = Number.isInteger(result) ? 
      { type: 'Integer' as const, singleton: true } : 
      { type: 'Decimal' as const, singleton: true };
    return { value: [box(result, typeInfo)], context };
  }
  
  // For other types, convert to string
  return { value: [box(String(l) + String(r), { type: 'String', singleton: true })], context };
};

export const plusOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '+',
  name: 'plus',
  category: ['arithmetic'],
  precedence: PRECEDENCE.ADDITIVE,
  associativity: 'left',
  description: 'For Integer, Decimal, and Quantity, adds the operands. For strings, concatenates the right operand to the left operand. For Date/DateTime/Time, increments by time-valued quantity.',
  examples: ['2 + 3', '"Hello" + " " + "World"', '@2018-03-01 + 1 day', '3 \'m\' + 3 \'cm\''],
  signatures: [
    {
      name: 'integer-plus',
      left: { type: 'Integer', singleton: true },
      right: { type: 'Integer', singleton: true },
      result: { type: 'Integer', singleton: true },
    },
    {
      name: 'decimal-plus',
      left: { type: 'Decimal', singleton: true },
      right: { type: 'Decimal', singleton: true },
      result: { type: 'Decimal', singleton: true },
    },
    {
      name: 'string-plus',
      left: { type: 'String', singleton: true },
      right: { type: 'String', singleton: true },
      result: { type: 'String', singleton: true },
    },
    {
      name: 'quantity-plus',
      left: { type: 'Quantity', singleton: true },
      right: { type: 'Quantity', singleton: true },
      result: { type: 'Quantity', singleton: true },
    },
    {
      name: 'date-plus',
      left: { type: 'Date', singleton: true },
      right: { type: 'Quantity', singleton: true },
      result: { type: 'Date', singleton: true },
    },
    {
      name: 'datetime-plus',
      left: { type: 'DateTime', singleton: true },
      right: { type: 'Quantity', singleton: true },
      result: { type: 'DateTime', singleton: true },
    },
    {
      name: 'time-plus',
      left: { type: 'Time', singleton: true },
      right: { type: 'Quantity', singleton: true },
      result: { type: 'Time', singleton: true },
    }
  ],
  evaluate
};