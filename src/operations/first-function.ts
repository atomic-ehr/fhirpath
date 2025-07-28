import type { FunctionDefinition } from '../types';
import type { FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  return { 
    value: input.length > 0 ? [input[0]] : [], 
    context 
  };
};

export const firstFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'first',
  category: ['collection'],
  description: 'Returns the first item in the collection',
  examples: ['Patient.name.first()'],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [],
    result: { type: 'Any', singleton: true },
  },
  evaluate
};