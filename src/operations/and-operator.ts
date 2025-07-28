import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../interpreter';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  // Three-valued logic implementation
  if (left.length === 0 || right.length === 0) {
    // If either operand is false, result is false
    if (left.length > 0 && left[0] === false) {
      return { value: [false], context };
    }
    if (right.length > 0 && right[0] === false) {
      return { value: [false], context };
    }
    // Otherwise unknown
    return { value: [], context };
  }
  return { value: [left[0] && right[0]], context };
};

export const andOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: 'and',
  name: 'and',
  category: ['logical'],
  precedence: PRECEDENCE.AND,
  associativity: 'left',
  description: 'Logical AND operator',
  examples: ['active and verified'],
  signatures: [],
  evaluate
};