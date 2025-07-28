import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../interpreter';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  if (left.length === 0) {
    return { value: [true], context }; // {} in collection = true
  }
  if (right.length === 0) {
    return { value: [false], context }; // value in {} = false
  }
  // Check if all elements of left are in right
  for (const leftItem of left) {
    let found = false;
    for (const rightItem of right) {
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

export const inOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: 'in',
  name: 'in',
  category: ['membership'],
  precedence: PRECEDENCE.IN_CONTAINS,
  associativity: 'left',
  description: 'Membership test operator',
  examples: ['5 in list'],
  signatures: [],
  evaluate
};