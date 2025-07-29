import type { FunctionDefinition, FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // isDistinct takes no arguments
  if (args.length !== 0) {
    throw new Error('isDistinct() takes no arguments');
  }

  // If input is empty, return true
  if (input.length === 0) {
    return { value: [true], context };
  }

  // Check if all items are distinct by comparing each pair
  // Using the equals (=) operator logic for comparison
  for (let i = 0; i < input.length; i++) {
    for (let j = i + 1; j < input.length; j++) {
      // Two items are considered equal if they have the same value
      // Using === for primitive comparison (matching the equal operator behavior)
      if (input[i] === input[j]) {
        return { value: [false], context };
      }
    }
  }

  // All items are distinct
  return { value: [true], context };
};

export const isDistinctFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'isDistinct',
  category: ['existence'],
  description: 'Returns true if all the items in the input collection are distinct. To determine whether two items are distinct, the equals (=) operator is used. If the input collection is empty, the result is true.',
  examples: [
    "(1 | 2 | 3).isDistinct()",
    "(1 | 2 | 2 | 3).isDistinct()",
    "Patient.name.given.isDistinct()"
  ],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [],
    result: { type: 'Boolean', singleton: true }
  },
  evaluate
};