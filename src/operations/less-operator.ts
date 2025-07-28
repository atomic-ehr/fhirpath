import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../interpreter';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  if (left.length === 0 || right.length === 0) {
    return { value: [], context };
  }
  return { value: [left[0] < right[0]], context };
};

export const lessOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '<',
  name: 'less',
  category: ['comparison'],
  precedence: PRECEDENCE.COMPARISON,
  associativity: 'left',
  description: 'Less than operator',
  examples: ['age < 18'],
  signatures: [],
  evaluate
};