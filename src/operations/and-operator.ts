import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: OperationEvaluator = async (input, context, left, right) => {
  // Three-valued logic implementation
  
  // Get values safely
  const leftBoxed = left.length > 0 ? left[0] : null;
  const rightBoxed = right.length > 0 ? right[0] : null;
  
  const leftValue = leftBoxed ? unbox(leftBoxed) : null;
  const rightValue = rightBoxed ? unbox(rightBoxed) : null;
  
  // If either operand is false, result is false
  if (leftValue === false || rightValue === false) {
    return { value: [box(false, { type: 'Boolean', singleton: true })], context };
  }
  
  // If both operands are true, result is true
  if (leftValue === true && rightValue === true) {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }
  
  // Otherwise (empty or non-boolean), result is empty
  return { value: [], context };
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