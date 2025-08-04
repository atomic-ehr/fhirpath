import type { FunctionDefinition } from '../types';
import type { FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  if (input.length > 0) {
    const lastItem = input[input.length - 1];
    // TypeScript knows lastItem is defined here
    return { value: [lastItem!], context };
  }
  return { value: [], context };
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