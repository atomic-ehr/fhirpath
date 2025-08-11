import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // combine() requires exactly one argument (the other collection)
  if (!args || args.length !== 1) {
    throw Errors.invalidOperation('combine requires exactly one argument');
  }

  // Evaluate the argument to get the other collection
  const otherArg = args[0];
  if (!otherArg) {
    throw Errors.argumentRequired('combine', 'collection argument');
  }
  
  // Evaluate the argument expression
  // The argument should be evaluated in the root context, not the current input
  // Use context.input which contains the root data
  const otherResult = evaluator(otherArg, context.input || [], context);
  const otherCollection = otherResult.value;

  // Merge the input and other collections into a single collection
  // without eliminating duplicate values
  const combined = [...input, ...otherCollection];

  return { value: combined, context };
};

export const combineFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'combine',
  category: ['collection'],
  description: 'Merge the input and other collections into a single collection without eliminating duplicate values. Combining an empty collection with a non-empty collection will return the non-empty collection. There is no expectation of order in the resulting collection.',
  examples: [
    "{1, 2, 3}.combine({3, 4, 5}) // returns {1, 2, 3, 3, 4, 5}"
  ],
  signatures: [{

    name: 'combine',
    input: { type: 'Any', singleton: false },
    parameters: [
      { name: 'other', type: { type: 'Any', singleton: false } }
    ],
    result: { type: 'Any', singleton: false }
  }],
  evaluate
};