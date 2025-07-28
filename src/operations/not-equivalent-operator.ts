import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../interpreter';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  // FHIRPath not-equivalence
  if (left.length === 0 && right.length === 0) {
    return { value: [false], context };
  }
  if (left.length !== right.length) {
    return { value: [true], context };
  }
  // TODO: Implement proper not-equivalence logic
  return { value: [left[0] !== right[0]], context };
};

export const notEquivalentOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '!~',
  name: 'notEquivalent',
  category: ['equality'],
  precedence: PRECEDENCE.EQUALITY,
  associativity: 'left',
  description: 'Not equivalent operator',
  examples: ['value !~ other'],
  signatures: [],
  evaluate
};