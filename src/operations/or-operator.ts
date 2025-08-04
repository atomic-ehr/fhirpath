import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  // Three-valued logic implementation
  
  // Get values safely
  const leftBoxed = left.length > 0 ? left[0] : null;
  const rightBoxed = right.length > 0 ? right[0] : null;
  
  const leftValue = leftBoxed ? unbox(leftBoxed) : null;
  const rightValue = rightBoxed ? unbox(rightBoxed) : null;
  
  // If either operand is true, result is true
  if (leftValue === true || rightValue === true) {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }
  
  // If both operands are false, result is false
  if (leftValue === false && rightValue === false) {
    return { value: [box(false, { type: 'Boolean', singleton: true })], context };
  }
  
  // Otherwise (empty or non-boolean), result is empty
  return { value: [], context };
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