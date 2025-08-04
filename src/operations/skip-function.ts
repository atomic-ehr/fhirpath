import type { FunctionDefinition } from '../types';
import type { FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  if (args.length !== 1) {
    throw new Error('skip() requires exactly one argument');
  }
  
  const numNode = args[0];
  if (!numNode) {
    throw new Error('skip() requires an argument');
  }
  
  // Evaluate the argument to get the number
  const numResult = evaluator(numNode, input, context);
  
  if (numResult.value.length === 0) {
    throw new Error('skip() argument cannot be empty');
  }
  
  const boxedSkipValue = numResult.value[0];
  if (!boxedSkipValue) {
    throw new Error('skip() argument must be a single value');
  }
  
  const skipValue = unbox(boxedSkipValue);
  
  if (typeof skipValue !== 'number' || !Number.isInteger(skipValue)) {
    throw new Error('skip() argument must be an integer');
  }
  
  // If num <= 0, return the input collection as is
  if (skipValue <= 0) {
    return { value: input, context };
  }
  
  // Skip the first 'num' items
  return { 
    value: input.slice(skipValue), 
    context 
  };
};

export const skipFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'skip',
  category: ['collection'],
  description: 'Returns a collection containing all but the first num items in the input collection',
  examples: [
    '[1,2,3,4,5].skip(2)',
    'Patient.name.skip(1)'
  ],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [
      { name: 'num', type: { type: 'Integer', singleton: true } }
    ],
    result: { type: 'Any', singleton: false },
  },
  evaluate
};