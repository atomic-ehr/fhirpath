import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { equalQuantities } from '../quantity-value';
import type { QuantityValue } from '../quantity-value';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  if (left.length === 0 || right.length === 0) {
    return { value: [], context };
  }
  
  const l = left[0];
  const r = right[0];
  
  // Check if both are quantities
  if (l && typeof l === 'object' && 'unit' in l && 
      r && typeof r === 'object' && 'unit' in r) {
    return { value: [!equalQuantities(l as QuantityValue, r as QuantityValue)], context };
  }
  
  return { value: [l !== r], context };
};

export const notEqualOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '!=',
  name: 'notEqual',
  category: ['equality'],
  precedence: PRECEDENCE.EQUALITY,
  associativity: 'left',
  description: 'The converse of the equals operator, returning true if equal returns false; false if equal returns true; and empty ({ }) if equal returns empty',
  examples: ['name != "John"', 'Patient.gender != "male"', '5 != 3'],
  signatures: [{
    name: 'not-equal',
    left: { type: 'Any', singleton: true },
    right: { type: 'Any', singleton: true },
    result: { type: 'Boolean', singleton: true },
  }],
  evaluate
};