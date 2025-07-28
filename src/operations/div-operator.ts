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
  description: 'Integer division operator',
  examples: ['10 div 3'],
  signatures: [],
  evaluate
};