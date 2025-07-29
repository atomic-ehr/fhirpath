import type { FunctionDefinition, FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // toBoolean() takes no arguments
  if (args.length !== 0) {
    throw new Error('toBoolean() takes no arguments');
  }

  // If input collection is empty, result is empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input collection contains multiple items, signal an error
  if (input.length > 1) {
    throw new Error('toBoolean() can only be applied to a single item');
  }

  const inputValue = input[0];

  // Handle different input types according to spec
  
  // Boolean - return as is
  if (typeof inputValue === 'boolean') {
    return { value: [inputValue], context };
  }
  
  // Integer - 1 -> true, 0 -> false
  if (typeof inputValue === 'number' && Number.isInteger(inputValue)) {
    if (inputValue === 1) {
      return { value: [true], context };
    } else if (inputValue === 0) {
      return { value: [false], context };
    }
    // Other integers return empty
    return { value: [], context };
  }
  
  // Decimal - 1.0 -> true, 0.0 -> false
  if (typeof inputValue === 'number' && !Number.isInteger(inputValue)) {
    if (inputValue === 1.0) {
      return { value: [true], context };
    } else if (inputValue === 0.0) {
      return { value: [false], context };
    }
    // Other decimals return empty
    return { value: [], context };
  }
  
  // String - various representations (case insensitive)
  if (typeof inputValue === 'string') {
    const lowerValue = inputValue.toLowerCase();
    
    // True representations
    if (['true', 't', 'yes', 'y', '1', '1.0'].includes(lowerValue)) {
      return { value: [true], context };
    }
    
    // False representations
    if (['false', 'f', 'no', 'n', '0', '0.0'].includes(lowerValue)) {
      return { value: [false], context };
    }
    
    // Other strings return empty
    return { value: [], context };
  }

  // For all other types, return empty
  return { value: [], context };
};

export const toBooleanFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'toBoolean',
  category: ['type-conversion'],
  description: 'Converts the input to a Boolean. Accepts: Boolean (identity), Integer (1->true, 0->false), Decimal (1.0->true, 0.0->false), String (\'true\'/\'t\'/\'yes\'/\'y\'/\'1\'/\'1.0\'->true, \'false\'/\'f\'/\'no\'/\'n\'/\'0\'/\'0.0\'->false, case insensitive). Returns empty for all other values. Throws error for multiple input items.',
  examples: [
    "'true'.toBoolean()",
    "'FALSE'.toBoolean()",
    "'yes'.toBoolean()",
    "'no'.toBoolean()",
    "1.toBoolean()",
    "0.toBoolean()",
    "1.0.toBoolean()",
    "0.0.toBoolean()"
  ],
  signature: {
    input: { type: 'Any', singleton: true },
    parameters: [],
    result: { type: 'Boolean', singleton: true }
  },
  evaluate
};