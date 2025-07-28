import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  if (left.length === 0 || right.length === 0) {
    return { value: [], context };
  }
  if (right[0] === 0) {
    return { value: [], context };
  }
  return { value: [left[0] % right[0]], context };
};

export const modOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: 'mod',
  name: 'mod',
  category: ['arithmetic'],
  precedence: PRECEDENCE.MULTIPLICATIVE,
  associativity: 'left',
  description: 'Computes the remainder of the truncated division of its arguments. Supported for Integer and Decimal types. Division by zero returns empty.',
  examples: ['5 mod 2', '5.5 mod 0.7', '5 mod 0'],
  signatures: [
    {
      name: 'integer-mod',
      left: { type: 'Integer', singleton: true },
      right: { type: 'Integer', singleton: true },
      result: { type: 'Integer', singleton: true },
    },
    {
      name: 'decimal-mod',
      left: { type: 'Decimal', singleton: true },
      right: { type: 'Decimal', singleton: true },
      result: { type: 'Decimal', singleton: true },
    }
  ],
  evaluate
};