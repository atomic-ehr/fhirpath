import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  // If right is empty, result is empty
  if (right.length === 0) {
    return { value: [], context };
  }
  
  // Right must have single item
  if (right.length > 1) {
    throw new Error('contains operator: right operand must be a single item');
  }
  
  // If left is empty, result is false
  if (left.length === 0) {
    return { value: [box(false, { type: 'Boolean', singleton: true })], context };
  }
  
  // Check if the single right item is in left using equality
  const boxedRightItem = right[0];
  if (!boxedRightItem) {
    return { value: [box(false, { type: 'Boolean', singleton: true })], context };
  }
  const rightItem = unbox(boxedRightItem);
  
  for (const boxedLeftItem of left) {
    const leftItem = unbox(boxedLeftItem);
    if (leftItem === rightItem) {
      return { value: [box(true, { type: 'Boolean', singleton: true })], context };
    }
  }
  
  return { value: [box(false, { type: 'Boolean', singleton: true })], context };
};

export const containsOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: 'contains',
  name: 'contains',
  category: ['membership'],
  precedence: PRECEDENCE.IN_CONTAINS,
  associativity: 'left',
  description: 'If the right operand is a collection with a single item, returns true if the item is in the left operand using equality semantics. If the right is empty, the result is empty. If the left is empty, the result is false',
  examples: ['Patient.name.given contains \'Joe\'', '(1 | 2 | 3 | 4 | 5) contains 5', 'valueset.code contains code'],
  signatures: [
    {
      name: 'contains',
      left: { type: 'Any', singleton: false },
      right: { type: 'Any', singleton: true },
      result: { type: 'Boolean', singleton: true },
    }
  ],
  evaluate
};