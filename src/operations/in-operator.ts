import type { OperatorDefinition } from '../types';
import { Errors } from '../errors';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  // If left is empty, result is empty
  if (left.length === 0) {
    return { value: [], context };
  }
  
  // Left must have single item
  if (left.length > 1) {
    throw Errors.invalidOperation('in operator: left operand must be a single item');
  }
  
  // If right is empty, result is false
  if (right.length === 0) {
    return { value: [box(false, { type: 'Boolean', singleton: true })], context };
  }
  
  // Check if the single left item is in right using equality
  const boxedLeftItem = left[0];
  if (!boxedLeftItem) {
    return { value: [], context };
  }
  
  const leftItem = unbox(boxedLeftItem);
  
  for (const boxedRightItem of right) {
    const rightItem = unbox(boxedRightItem);
    // Use deep equality for comparison
    if (JSON.stringify(leftItem) === JSON.stringify(rightItem)) {
      return { value: [box(true, { type: 'Boolean', singleton: true })], context };
    }
  }
  
  return { value: [box(false, { type: 'Boolean', singleton: true })], context };
};

export const inOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: 'in',
  name: 'in',
  category: ['membership'],
  precedence: PRECEDENCE.IN_CONTAINS,
  associativity: 'left',
  description: 'If the left operand is a collection with a single item, returns true if the item is in the right operand using equality semantics. If the left is empty, the result is empty. If the right is empty, the result is false.',
  examples: ['\'Joe\' in Patient.name.given', '5 in (1 | 2 | 3 | 4 | 5)', 'code in terminologyServer.valueset(\'my-valueset\').code'],
  signatures: [
    {
      name: 'in',
      left: { type: 'Any', singleton: true },
      right: { type: 'Any', singleton: false },
      result: { type: 'Boolean', singleton: true },
    }
  ],
  evaluate
};