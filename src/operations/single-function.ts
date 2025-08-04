import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // single takes no arguments
  if (args.length !== 0) {
    throw new Error('single() takes no arguments');
  }

  // If input is empty, return empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If there is exactly one item, return it
  if (input.length === 1) {
    return { value: input[0] ? [input[0]] : [], context };
  }

  // If there are multiple items, signal an error
  throw new Error('single() requires collection to have exactly one item');
};

export const singleFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'single',
  category: ['subsetting'],
  description: 'Returns the single item in the input if there is just one item. If the input collection is empty, the result is empty. If there are multiple items, an error is signaled.',
  examples: [
    "Patient.name.single()",
    "Patient.identifier.single()"
  ],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [],
    result: { type: 'Any', singleton: true }
  },
  evaluate
};