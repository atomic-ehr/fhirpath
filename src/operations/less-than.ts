import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { box, unbox } from '../boxing';
import { compareQuantities, type QuantityValue } from '../quantity-value';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  if (left.length === 0 || right.length === 0) {
    return { value: [], context };
  }
  
  const boxedLeft = left[0];
  const boxedRight = right[0];
  if (!boxedLeft || !boxedRight) {
    return { value: [], context };
  }
  
  const leftValue = unbox(boxedLeft);
  const rightValue = unbox(boxedRight);
  
  // Handle quantity comparison
  if (leftValue && typeof leftValue === 'object' && 'value' in leftValue && 'unit' in leftValue &&
      rightValue && typeof rightValue === 'object' && 'value' in rightValue && 'unit' in rightValue) {
    const comparison = compareQuantities(leftValue as QuantityValue, rightValue as QuantityValue);
    if (comparison === null) {
      // Incompatible units - return empty
      return { value: [], context };
    }
    return { value: [box(comparison < 0, { type: 'Boolean', singleton: true })], context };
  }
  
  // Regular comparison
  return { value: [box((leftValue as any) < (rightValue as any), { type: 'Boolean', singleton: true })], context };
};

export const lessThanOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '<',
  name: 'less-than',
  category: ['comparison'],
  precedence: PRECEDENCE.COMPARISON,
  associativity: 'left',
  description: 'Less than comparison',
  examples: ['5 < 10', 'age < 18'],
  signatures: [{
    name: 'less-than',
    left: { type: 'Any', singleton: true },
    right: { type: 'Any', singleton: true },
    result: { type: 'Boolean', singleton: true },
  }],
  evaluate
};