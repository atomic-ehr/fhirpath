import type { FunctionDefinition } from '../types';
import type { FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  return { 
    value: [box(input.length === 0, { type: 'Boolean', singleton: true })], 
    context 
  };
};

export const emptyFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'empty',
  category: ['collection', 'logical'],
  description: 'Returns true if the collection is empty',
  examples: ['Patient.name.empty()'],
  signatures: [{

    name: 'empty',
    input: { type: 'Any', singleton: false },
    parameters: [],
    result: { type: 'Boolean', singleton: true },
  }],
  evaluate
};