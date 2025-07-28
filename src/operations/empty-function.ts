import type { FunctionDefinition } from '../types';
import type { FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  return { 
    value: [input.length === 0], 
    context 
  };
};

export const emptyFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'empty',
  category: ['collection', 'logical'],
  description: 'Returns true if the collection is empty',
  examples: ['Patient.name.empty()'],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [],
    result: { type: 'Boolean', singleton: true },
  },
  evaluate
};