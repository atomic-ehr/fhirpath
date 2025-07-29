import type { FunctionDefinition, FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // trim() takes no arguments
  if (args.length !== 0) {
    throw new Error('trim() takes no arguments');
  }

  // If input collection is empty, result is empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input collection contains multiple items, signal an error
  if (input.length > 1) {
    throw new Error('trim() can only be applied to a single string');
  }

  // Input must be a string
  const inputValue = input[0];
  if (typeof inputValue !== 'string') {
    // Non-string input returns empty
    return { value: [], context };
  }

  // Trim whitespace from beginning and end
  // FHIRPath defines whitespace as: tab (\t), space ( ), line feed (\n), carriage return (\r)
  const trimmed = inputValue.trim();
  
  return { value: [trimmed], context };
};

export const trimFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'trim',
  category: ['string'],
  description: 'Trims whitespace characters from the beginning and ending of the input string. Whitespace includes tab (\\t), space ( ), line feed (\\n) and carriage return (\\r). If the input is empty, the result is empty.',
  examples: [
    "'  hello  '.trim()",
    "'\\thello\\n'.trim()",
    "'no-trim'.trim()"
  ],
  signature: {
    input: { type: 'String', singleton: true },
    parameters: [],
    result: { type: 'String', singleton: true }
  },
  evaluate
};