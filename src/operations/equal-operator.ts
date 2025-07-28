import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  if (left.length === 0 || right.length === 0) {
    return { value: [], context };
  }
  return { value: [left[0] === right[0]], context };
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