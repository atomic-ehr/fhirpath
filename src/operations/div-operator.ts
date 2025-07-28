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
  return { value: [Math.floor(left[0] / right[0])], context };
};

export const divOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: 'div',
  name: 'div',
  category: ['arithmetic'],
  precedence: PRECEDENCE.MULTIPLICATIVE,
  associativity: 'left',
  description: 'Performs truncated division (integer division) of the left operand by the right operand, ignoring any remainder. Always returns an Integer, even if operands are Decimal. Division by zero returns empty.',
  examples: ['5 div 2', '5.5 div 0.7', '10 div 3', '5 div 0'],
  signatures: [
    {
      name: 'integer-div',
      left: { type: 'Integer', singleton: true },
      right: { type: 'Integer', singleton: true },
      result: { type: 'Integer', singleton: true },
    },
    {
      name: 'decimal-div',
      left: { type: 'Decimal', singleton: true },
      right: { type: 'Decimal', singleton: true },
      result: { type: 'Integer', singleton: true },
    }
  ],
  evaluate
};