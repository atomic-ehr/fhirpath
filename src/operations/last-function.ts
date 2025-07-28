import type { FunctionDefinition } from '../types';
import type { FunctionEvaluator } from '../interpreter';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  return { 
    value: input.length > 0 ? [input[input.length - 1]] : [], 
    context 
  };
};

export const lastFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'last',
  category: ['collection'],
  description: 'Returns the last item in the collection',
  examples: ['Patient.name.last()'],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [],
    result: { type: 'Any', singleton: true },
  },
  evaluate
};