import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { box, unbox } from '../interpreter/boxing';

export const evaluate: OperationEvaluator = async (input, context, left, right) => {
  // & operator requires singleton operands (or empty)
  // Empty collections are treated as empty string
  
  // Check for multiple items in left operand
  if (left.length > 1) {
    const { Errors } = await import('../errors');
    throw Errors.invalidOperation('& operator requires singleton operands, left operand contains multiple items');
  }
  
  // Check for multiple items in right operand
  if (right.length > 1) {
    const { Errors } = await import('../errors');
    throw Errors.invalidOperation('& operator requires singleton operands, right operand contains multiple items');
  }
  
  const leftStr = left.length === 0 ? '' : String(unbox(left[0]));
  const rightStr = right.length === 0 ? '' : String(unbox(right[0]));
  
  // Always return a string, even if both are empty
  return { value: [box(leftStr + rightStr, { type: 'String', singleton: true })], context };
};

export const combineOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '&',
  name: 'combine',
  doesNotPropagateEmpty: true,  // Treats empty as empty string, always returns a string
  category: ['string'],
  precedence: PRECEDENCE.ADDITIVE,
  associativity: 'left',
  description: 'String concatenation operator that requires singleton operands. Empty collections are treated as empty strings.',
  examples: ['first & " " & last'],
  signatures: [
    {
      name: 'string-combine',
      left: { type: 'String', singleton: true },
      right: { type: 'String', singleton: true },
      result: { type: 'String', singleton: true },
    },
    {
      name: 'any-combine',
      left: { type: 'Any' },
      right: { type: 'Any' },
      result: { type: 'String', singleton: true },
    }
  ],
  evaluate
};