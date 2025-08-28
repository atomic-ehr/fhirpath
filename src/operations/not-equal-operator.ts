import type { OperatorDefinition, OperationEvaluator } from '../types';
import { PRECEDENCE } from '../types';
import { box } from '../boxing';
import { collectionsNotEqual } from '../comparison';

export const evaluate: OperationEvaluator = async (input, context, left, right) => {
  // Use the unified comparison system
  const result = collectionsNotEqual(left, right);
  
  // null means incomparable (returns empty)
  if (result === null) {
    return { value: [], context };
  }
  
  // Return the boolean result
  return { value: [box(result, { type: 'Boolean', singleton: true })], context };
};

export const notEqualOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '!=',
  name: 'notEqual',
  category: ['equality'],
  precedence: PRECEDENCE.EQUALITY,
  associativity: 'left',
  description: 'The converse of the equals operator, returning true if equal returns false; false if equal returns true; and empty ({ }) if equal returns empty',
  examples: ['name != "John"', 'Patient.gender != "male"', '5 != 3'],
  signatures: [
    {
      name: 'not-equal',
      left: { type: 'Any', singleton: true },
      right: { type: 'Any', singleton: true },
      result: { type: 'Boolean', singleton: true },
    },
    {
      name: 'not-equal',
      left: { type: 'Any', singleton: false },
      right: { type: 'Any', singleton: false },
      result: { type: 'Boolean', singleton: true },
    }
  ],
  evaluate
};