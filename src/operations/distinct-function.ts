import type { FunctionDefinition } from '../types';
import type { FunctionEvaluator } from '../interpreter';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // Use Set to remove duplicates
  // Note: This uses JavaScript's default equality which may not handle
  // complex objects correctly. A full implementation would need deep equality.
  return { 
    value: [...new Set(input)], 
    context 
  };
};

export const distinctFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'distinct',
  category: ['collection'],
  description: 'Returns a collection containing only unique items',
  examples: ['Patient.name.given.distinct()'],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [],
    result: { type: 'Any', singleton: false },
  },
  evaluate
};