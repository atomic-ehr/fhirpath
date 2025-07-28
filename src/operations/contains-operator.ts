import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  // 'contains' is the inverse of 'in'
  if (right.length === 0) {
    return { value: [true], context }; // collection contains {} = true
  }
  if (left.length === 0) {
    return { value: [false], context }; // {} contains value = false
  }
  // Check if all elements of right are in left
  for (const rightItem of right) {
    let found = false;
    for (const leftItem of left) {
      if (leftItem === rightItem) {
        found = true;
        break;
      }
    }
    if (!found) {
      return { value: [false], context };
    }
  }
  return { value: [true], context };
};

export const containsOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: 'contains',
  name: 'contains',
  category: ['membership'],
  precedence: PRECEDENCE.IN_CONTAINS,
  associativity: 'left',
  description: 'Contains operator',
  examples: ['list contains 5'],
  signatures: [],
  evaluate
};