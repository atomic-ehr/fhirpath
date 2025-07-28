import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  if (left.length === 0 || right.length === 0) {
    return { value: [], context };
  }
  return { value: [left[0] !== right[0]], context };
};

export const notEqualOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '!=',
  name: 'notEqual',
  category: ['equality'],
  precedence: PRECEDENCE.EQUALITY,
  associativity: 'left',
  description: 'Not equal operator',
  examples: ['name != "John"'],
  signatures: [],
  evaluate
};