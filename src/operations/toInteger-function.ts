import type { FunctionDefinition, FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // toInteger() takes no arguments
  if (args.length !== 0) {
    throw new Error('toInteger() takes no arguments');
  }

  // If input collection is empty, result is empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input collection contains multiple items, signal an error
  if (input.length > 1) {
    throw new Error('toInteger() can only be applied to a single item');
  }

  const inputValue = input[0];

  // Handle different input types according to spec
  
  // Integer - return as is
  if (typeof inputValue === 'number' && Number.isInteger(inputValue)) {
    return { value: [inputValue], context };
  }
  
  // String - convert if valid integer format
  if (typeof inputValue === 'string') {
    // Regex from spec: (\+|-)?\d+
    const integerRegex = /^(\+|-)?\d+$/;
    if (integerRegex.test(inputValue)) {
      const intValue = parseInt(inputValue, 10);
      return { value: [intValue], context };
    }
    // String not convertible to integer - return empty
    return { value: [], context };
  }
  
  // Boolean - true -> 1, false -> 0
  if (typeof inputValue === 'boolean') {
    return { value: [inputValue ? 1 : 0], context };
  }

  // For all other types (including decimals), return empty
  return { value: [], context };
};

export const toIntegerFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'toInteger',
  category: ['type-conversion'],
  description: 'Converts the input to an Integer. Returns an integer for: Integer (identity), String convertible to integer (using regex (\\+|-)?\\d+), Boolean (true->1, false->0). Returns empty for all other types or non-convertible strings. Throws error for multiple input items.',
  examples: [
    "'42'.toInteger()",
    "'+123'.toInteger()",
    "'-456'.toInteger()",
    "true.toInteger()",
    "false.toInteger()",
    "'hello'.toInteger()"
  ],
  signature: {
    input: { type: 'Any', singleton: true },
    parameters: [],
    result: { type: 'Integer', singleton: true }
  },
  evaluate
};