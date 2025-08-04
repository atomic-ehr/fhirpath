import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // truncate() takes no arguments
  if (args.length !== 0) {
    throw new Error('truncate() takes no arguments');
  }

  // If input is empty, return empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input has multiple items, error
  if (input.length > 1) {
    throw new Error('truncate() can only be applied to a single item');
  }

  const boxedValue = input[0];
  if (!boxedValue) return { value: [], context };
  const value = unbox(boxedValue);

  // Must be a number
  if (typeof value !== 'number') {
    throw new Error(`Cannot apply truncate() to ${typeof value}`);
  }

  // Math.trunc removes decimal part (towards zero)
  return { value: [box(Math.trunc(value), { type: 'Integer', singleton: true })], context };
};

export const truncateFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'truncate',
  category: ['math'],
  description: 'Returns the integer portion of the input.',
  examples: [
    '101.truncate()',
    '1.00000001.truncate()',
    '(-1.56).truncate()'
  ],
  signature: {
    input: { type: 'Decimal', singleton: true },
    parameters: [],
    result: { type: 'Integer', singleton: true }
  },
  evaluate
};