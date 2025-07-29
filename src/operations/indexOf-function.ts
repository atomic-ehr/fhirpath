import type { FunctionDefinition, FunctionEvaluator, LiteralNode } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // Check single item in input
  if (input.length === 0) {
    return { value: [], context };
  }
  
  if (input.length > 1) {
    throw new Error('indexOf() can only be used on single string values');
  }

  const inputValue = input[0];
  if (typeof inputValue !== 'string') {
    throw new Error('indexOf() can only be used on string values');
  }

  // Check arguments
  if (args.length !== 1) {
    throw new Error('indexOf() requires exactly 1 argument');
  }

  // Evaluate substring argument
  const substringArg = args[0];
  if (!substringArg) {
    throw new Error('indexOf() requires a substring argument');
  }
  
  const substringResult = evaluator(substringArg, input, context);
  
  if (substringResult.value.length === 0) {
    return { value: [], context };
  }
  
  if (substringResult.value.length > 1) {
    throw new Error('indexOf() substring argument must be a single value');
  }
  
  const substring = substringResult.value[0];
  if (typeof substring !== 'string') {
    throw new Error('indexOf() substring argument must be a string');
  }

  // Handle empty substring - returns 0 per spec
  if (substring === '') {
    return { value: [0], context };
  }

  // Find the index
  const index = inputValue.indexOf(substring);
  
  return { value: [index], context };
};

export const indexOfFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'indexOf',
  category: ['string'],
  description: 'Returns the 0-based index of the first position substring is found in the input string, or -1 if it is not found',
  examples: [
    "'abcdefg'.indexOf('bc')",
    "'abcdefg'.indexOf('x')",
    "'abcdefg'.indexOf('abcdefg')"
  ],
  signature: {
    input: { type: 'String', singleton: true },
    parameters: [
      { name: 'substring', type: { type: 'String', singleton: true } }
    ],
    result: { type: 'Integer', singleton: true }
  },
  evaluate
};