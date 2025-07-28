import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  // Three-valued logic implementation
  if (left.length === 0 || right.length === 0) {
    // If either operand is true, result is true
    if (left.length > 0 && left[0] === true) {
      return { value: [true], context };
    }
    if (right.length > 0 && right[0] === true) {
      return { value: [true], context };
    }
    // Otherwise unknown
    return { value: [], context };
  }
  return { value: [left[0] || right[0]], context };
};

export const orOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: 'or',
  name: 'or',
  category: ['logical'],
  precedence: PRECEDENCE.OR,
  associativity: 'left',
  description: 'Returns false if both operands evaluate to false, true if either operand evaluates to true, and empty ({ }) otherwise',
  examples: ['true or false', 'Patient.active or Patient.gender = "female"'],
  signatures: [{
    name: 'or',
    left: { type: 'Boolean', singleton: true },
    right: { type: 'Boolean', singleton: true },
    result: { type: 'Boolean', singleton: true },
  }],
  evaluate
};