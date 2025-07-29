import type { FunctionDefinition, FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // Handle empty input collection
  if (input.length === 0) {
    return { value: [], context };
  }

  // Validate singleton input
  if (input.length !== 1) {
    throw new Error('split() requires a singleton input');
  }

  const inputValue = input[0];
  
  // Type check the input - must be a string
  if (typeof inputValue !== 'string') {
    throw new Error('split() can only be applied to string values');
  }

  // Validate arguments - requires exactly one argument
  if (!args || args.length !== 1) {
    throw new Error('split() requires exactly one argument');
  }

  // Evaluate the separator argument
  const separatorArg = args[0];
  if (!separatorArg) {
    throw new Error('split() requires exactly one argument');
  }
  const separatorResult = evaluator(separatorArg, input, context);
  
  if (separatorResult.value.length !== 1) {
    throw new Error('split() separator must be a singleton');
  }
  
  const separator = separatorResult.value[0];
  
  if (typeof separator !== 'string') {
    throw new Error('split() separator must be a string');
  }

  // Perform the split operation
  const result = inputValue.split(separator);

  return { value: result, context };
};

export const splitFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'split',
  category: ['string'],
  description: 'Splits a singleton input string into a list of strings, using the given separator. If the input is empty, the result is empty. If the input string does not contain any appearances of the separator, the result is the input string.',
  examples: [
    "('A,B,C').split(',') // returns { 'A', 'B', 'C' }",
    "('ABC').split(',') // returns { 'ABC' }",
    "'A,,C'.split(',') // returns { 'A', '', 'C' }"
  ],
  signature: {
    input: { type: 'String', singleton: true },
    parameters: [
      { name: 'separator', type: { type: 'String', singleton: true } }
    ],
    result: { type: 'String', singleton: false }
  },
  evaluate
};