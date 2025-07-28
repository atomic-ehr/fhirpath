import type { FunctionDefinition } from '../types';
import type { FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  return { 
    value: [input.length], 
    context 
  };
};

export const countFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'count',
  category: ['collection'],
  description: 'Returns the number of items in the collection',
  examples: ['Patient.name.count()'],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [],
    result: { type: 'Integer', singleton: true },
  },
  evaluate
};