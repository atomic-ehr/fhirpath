import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  if (left.length === 0 || right.length === 0) {
    return { value: [], context };
  }
  return { value: [left[0] !== right[0]], context };
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