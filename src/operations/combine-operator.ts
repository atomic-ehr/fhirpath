import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: OperationEvaluator = async (input, context, left, right) => {
  // Combine operator concatenates all values as strings
  const leftStr = left.map(v => String(unbox(v))).join('');
  const rightStr = right.map(v => String(unbox(v))).join('');
  
  if (leftStr === '' && rightStr === '') {
    return { value: [], context };
  }
  
  return { value: [box(leftStr + rightStr, { type: 'String', singleton: true })], context };
};

export const combineOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '&',
  name: 'combine',
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