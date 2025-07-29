import type { FunctionDefinition } from '../types';
import type { FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // If input is empty, return empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // Get separator from args (if provided)
  let separator = '';
  if (args.length > 0 && args[0]) {
    const sepResult = evaluator(args[0], input, context);
    if (sepResult.value.length > 0 && typeof sepResult.value[0] === 'string') {
      separator = sepResult.value[0];
    }
  }

  // Convert all input items to strings and join
  const stringValues = input.map(item => {
    if (item === null || item === undefined) {
      return '';
    }
    return String(item);
  });

  const result = stringValues.join(separator);

  return { 
    value: [result], 
    context 
  };
};

export const joinFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'join',
  category: ['string'],
  description: 'The join function takes a collection of strings and joins them into a single string, optionally using the given separator. If the input is empty, the result is empty. If no separator is specified, the strings are directly concatenated.',
  examples: [
    "('A' | 'B' | 'C').join() // 'ABC'",
    "('A' | 'B' | 'C').join(',') // 'A,B,C'"
  ],
  signature: {
    input: { type: 'String', singleton: false },
    parameters: [
      { 
        name: 'separator', 
        optional: true,
        type: { type: 'String', singleton: true } 
      },
    ],
    result: { type: 'String', singleton: true },
  },
  evaluate
};