import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { box, unbox } from '../interpreter/boxing';

export const evaluate: OperationEvaluator = async (input, context, left, right) => {
  // Combine operator concatenates all values as strings
  // Empty collections are treated as empty string
  const leftStr = left.length === 0 ? '' : left.map(v => String(unbox(v))).join('');
  const rightStr = right.length === 0 ? '' : right.map(v => String(unbox(v))).join('');
  
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
  description: 'String concatenation operator',
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