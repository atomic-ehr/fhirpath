import type { FunctionDefinition, FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // Validate arguments
  if (args.length !== 1) {
    throw new Error('endsWith() requires exactly 1 argument');
  }

  // If input is empty, return empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input has multiple items, signal an error
  if (input.length > 1) {
    throw new Error('endsWith() can only be used on single string values');
  }

  const inputValue = input[0];

  // Check that input is a string
  if (typeof inputValue !== 'string') {
    throw new Error('endsWith() can only be used on string values');
  }

  // Evaluate the suffix argument
  const suffixResult = evaluator(args[0], input, context);
  
  // Validate that suffix is a singleton string
  if (suffixResult.value.length !== 1) {
    throw new Error('endsWith() suffix argument must be a single value');
  }
  
  const suffix = suffixResult.value[0];
  
  // Check that suffix is a string
  if (typeof suffix !== 'string') {
    throw new Error('endsWith() suffix argument must be a string');
  }
  
  // If suffix is empty string, result is true
  if (suffix === '') {
    return { value: [true], context };
  }
  
  // Check if input ends with suffix
  const result = inputValue.endsWith(suffix);
  
  return { value: [result], context };
};

export const endsWithFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'endsWith',
  category: ['string'],
  description: 'Returns true when the input string ends with the given suffix. If suffix is the empty string, the result is true. If the input collection is empty, the result is empty. If the input collection contains multiple items, an error is signaled.',
  examples: [
    "'abcdefg'.endsWith('efg')",
    "'abcdefg'.endsWith('abc')"
  ],
  signature: {
    input: { type: 'String', singleton: true },
    parameters: [
      { name: 'suffix', type: { type: 'String', singleton: true } }
    ],
    result: { type: 'Boolean', singleton: true }
  },
  evaluate
};