import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../interpreter';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  // Three-valued logic for XOR
  if (left.length === 0 || right.length === 0) {
    return { value: [], context };
  }
  const l = left[0];
  const r = right[0];
  if (typeof l === 'boolean' && typeof r === 'boolean') {
    return { value: [l !== r], context };
  }
  return { value: [], context };
};

export const xorOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: 'xor',
  name: 'xor',
  category: ['logical'],
  precedence: PRECEDENCE.XOR,
  associativity: 'left',
  description: 'Logical XOR operator',
  examples: ['a xor b'],
  signatures: [],
  evaluate
};