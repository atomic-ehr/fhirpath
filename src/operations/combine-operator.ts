import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  // Combine operator concatenates all values as strings
  const leftStr = left.map(v => String(v)).join('');
  const rightStr = right.map(v => String(v)).join('');
  
  if (leftStr === '' && rightStr === '') {
    return { value: [], context };
  }
  
  return { value: [leftStr + rightStr], context };
};

export const combineOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '&',
  name: 'combine',
  category: ['string'],
  precedence: PRECEDENCE.ADDITIVE,
  associativity: 'left',
  description: 'String concatenation operator',
  examples: ['first & " " & last'],
  signatures: [],
  evaluate
};