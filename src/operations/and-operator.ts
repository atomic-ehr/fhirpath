import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';

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
  description: 'Returns true if both operands evaluate to true, false if either operand evaluates to false, and the empty collection ({ }) otherwise',
  examples: ['active and verified', 'Patient.active and Patient.gender = "male"'],
  signatures: [
    {
      name: 'and',
      left: { type: 'Boolean', singleton: true },
      right: { type: 'Boolean', singleton: true },
      result: { type: 'Boolean', singleton: true }
    }
  ],
  evaluate
};