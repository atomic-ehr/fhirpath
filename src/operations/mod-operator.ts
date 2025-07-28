import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../interpreter';

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
  description: 'Modulo operator',
  examples: ['10 mod 3'],
  signatures: [],
  evaluate
};