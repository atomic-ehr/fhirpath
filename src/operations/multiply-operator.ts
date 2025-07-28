import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  if (left.length === 0 || right.length === 0) {
    return { value: [], context };
  }
  return { value: [left[0] * right[0]], context };
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