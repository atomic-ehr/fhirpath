import type { FunctionDefinition, FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // sqrt() takes no arguments
  if (args.length !== 0) {
    throw new Error('sqrt() takes no arguments');
  }

  // If input is empty, return empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input has multiple items, error
  if (input.length > 1) {
    throw new Error('sqrt() can only be applied to a single item');
  }

  const value = input[0];

  // Must be a number
  if (typeof value !== 'number') {
    throw new Error(`Cannot apply sqrt() to ${typeof value}`);
  }

  // If negative, return empty (cannot represent square root of negative)
  if (value < 0) {
    return { value: [], context };
  }

  return { value: [Math.sqrt(value)], context };
};

export const sqrtFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'sqrt',
  category: ['math'],
  description: 'Returns the square root of the input number as a Decimal.',
  examples: [
    '81.sqrt()',
    '(-1).sqrt()'
  ],
  signature: {
    input: { type: 'Decimal', singleton: true },
    parameters: [],
    result: { type: 'Decimal', singleton: true }
  },
  evaluate
};