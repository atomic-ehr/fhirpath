import type { FunctionDefinition } from '../types';
import type { FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  if (input.length > 0) {
    const firstItem = input[0];
    // TypeScript knows firstItem is defined here
    return { value: [firstItem!], context };
  }
  return { value: [], context };
};

export const firstFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'first',
  category: ['collection'],
  description: 'Returns the first item in the collection',
  examples: ['Patient.name.first()'],
  signatures: [{

    name: 'first',
    input: { type: 'Any', singleton: false },
    parameters: [],
    result: 'inputTypeSingleton' as any,
  }],
  evaluate
};