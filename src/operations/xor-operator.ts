import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';

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
  description: 'Returns true if exactly one of the operands evaluates to true, false if either both operands evaluate to true or both operands evaluate to false, and empty ({ }) otherwise',
  examples: ['true xor false', 'Patient.active xor Patient.deceased.exists()'],
  signatures: [{
    name: 'xor',
    left: { type: 'Boolean', singleton: true },
    right: { type: 'Boolean', singleton: true },
    result: { type: 'Boolean', singleton: true },
  }],
  evaluate
};