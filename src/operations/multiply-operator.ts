import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../interpreter';

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
  description: 'Multiplication operator',
  examples: ['2 * 3', '5.5 * 2'],
  signatures: [{
    name: 'numeric-multiply',
    left: { type: 'Decimal', singleton: true },
    right: { type: 'Decimal', singleton: true },
    result: { type: 'Decimal', singleton: true },
  }],
  evaluate
};