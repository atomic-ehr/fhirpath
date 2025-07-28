import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../interpreter';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  // Three-valued logic for implies
  // implies is equivalent to (not left) or right
  if (left.length === 0) {
    return { value: [true], context }; // {} implies y = true
  }
  if (left[0] === false) {
    return { value: [true], context }; // false implies y = true
  }
  if (right.length === 0) {
    return { value: [], context }; // true implies {} = {}
  }
  return { value: [right[0]], context }; // true implies y = y
};

export const impliesOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: 'implies',
  name: 'implies',
  category: ['logical'],
  precedence: PRECEDENCE.IMPLIES,
  associativity: 'right',
  description: 'Logical implication operator',
  examples: ['condition implies result'],
  signatures: [],
  evaluate
};