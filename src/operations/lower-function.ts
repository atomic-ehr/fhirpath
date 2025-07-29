import type { FunctionDefinition, FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // Handle empty input collection
  if (input.length === 0) {
    return { value: [], context };
  }
  
  // If input contains multiple items, signal an error
  if (input.length > 1) {
    throw new Error('lower() can only be applied to a singleton string');
  }
  
  const inputValue = input[0];
  
  // Type check the input - must be a string
  if (typeof inputValue !== 'string') {
    throw new Error('lower() can only be applied to string values');
  }
  
  // lower() takes no arguments
  if (args && args.length > 0) {
    throw new Error('lower() does not take any arguments');
  }
  
  // Convert to lowercase
  const result = inputValue.toLowerCase();
  
  return { value: [result], context };
};

export const lowerFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'lower',
  category: ['string'],
  description: 'Returns the input string with all characters converted to lower case. If the input collection is empty, the result is empty. If the input collection contains multiple items, the evaluation of the expression will end and signal an error to the calling environment.',
  examples: [
    "'ABCDEFG'.lower() // returns 'abcdefg'",
    "'aBcDEFG'.lower() // returns 'abcdefg'"
  ],
  signature: {
    input: { type: 'String', singleton: true },
    parameters: [],
    result: { type: 'String', singleton: true }
  },
  evaluate
};