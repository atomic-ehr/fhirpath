import type { FunctionDefinition, FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // tail() takes no arguments
  if (args.length !== 0) {
    throw new Error('tail() takes no arguments');
  }
  
  // If input has 0 or 1 items, return empty collection
  if (input.length <= 1) {
    return { value: [], context };
  }
  
  // Return all but the first item
  return { 
    value: input.slice(1), 
    context 
  };
};

export const tailFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'tail',
  category: ['subsetting'],
  description: 'Returns a collection containing all but the first item in the input collection. Will return an empty collection if the input collection has no items, or only one item.',
  examples: [
    '[1,2,3,4,5].tail()',
    'Patient.name.tail()'
  ],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [],
    result: { type: 'Any', singleton: false }
  },
  evaluate
};