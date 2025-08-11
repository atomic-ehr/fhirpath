import type { FunctionDefinition } from '../types';
import type { FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  return { 
    value: [box(input.length, { type: 'Integer', singleton: true })], 
    context 
  };
};

export const countFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'count',
  category: ['collection'],
  description: 'Returns the number of items in the collection',
  examples: ['Patient.name.count()'],
  signatures: [{

    name: 'count',
    input: { type: 'Any', singleton: false },
    parameters: [],
    result: { type: 'Integer', singleton: true },
  }],
  evaluate
};