import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { equalQuantities, compareQuantities, type QuantityValue } from '../quantity-value';
import { box, unbox } from '../boxing';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  if (left.length === 0 || right.length === 0) {
    return { value: [], context };
  }
  
  const boxedL = left[0];
  const boxedR = right[0];
  
  if (!boxedL || !boxedR) {
    return { value: [], context };
  }
  
  const l = unbox(boxedL);
  const r = unbox(boxedR);
  
  // Check if both are quantities
  if (l && typeof l === 'object' && 'unit' in l && 
      r && typeof r === 'object' && 'unit' in r) {
    const comparison = compareQuantities(l as QuantityValue, r as QuantityValue);
    // If quantities are incomparable (different dimensions), return empty
    if (comparison === null) {
      return { value: [], context };
    }
    return { value: [box(comparison === 0, { type: 'Boolean', singleton: true })], context };
  }
  
  return { value: [box(l === r, { type: 'Boolean', singleton: true })], context };
};

export const equalOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '=',
  name: 'equal',
  category: ['equality'],
  precedence: PRECEDENCE.EQUALITY,
  associativity: 'left',
  description: 'Returns true if the left collection is equal to the right collection. For single items, comparison is type-specific. For collections, comparison is order-dependent.',
  examples: ['name = "John"', 'Patient.name.given = "John"', '5 = 5', '@2018-03-01 = @2018-03-01'],
  signatures: [{
    name: 'equal',
    left: { type: 'Any', singleton: true },
    right: { type: 'Any', singleton: true },
    result: { type: 'Boolean', singleton: true },
  }],
  evaluate
};