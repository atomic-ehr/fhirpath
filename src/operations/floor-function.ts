import type { FunctionDefinition, FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // floor() takes no arguments
  if (args.length !== 0) {
    throw new Error('floor() takes no arguments');
  }

  // If input is empty, return empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input has multiple items, error
  if (input.length > 1) {
    throw new Error('floor() can only be applied to a single item');
  }

  const value = input[0];

  // Must be a number
  if (typeof value !== 'number') {
    throw new Error(`Cannot apply floor() to ${typeof value}`);
  }

  return { value: [Math.floor(value)], context };
};

export const floorFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'floor',
  category: ['math'],
  description: 'Returns the first integer less than or equal to the input.',
  examples: [
    '1.floor()',
    '2.1.floor()',
    '(-2.1).floor()'
  ],
  signature: {
    input: { type: 'Decimal', singleton: true },
    parameters: [],
    result: { type: 'Integer', singleton: true }
  },
  evaluate
};