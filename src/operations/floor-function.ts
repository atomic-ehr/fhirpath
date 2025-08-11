import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // floor() takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('floor', 0, args.length);
  }

  // If input is empty, return empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input has multiple items, error
  if (input.length > 1) {
    throw Errors.singletonRequired('floor', input.length);
  }

  const boxedValue = input[0];
  if (!boxedValue) return { value: [], context };
  const value = unbox(boxedValue);

  // Must be a number
  if (typeof value !== 'number') {
    throw Errors.invalidOperandType('floor', `${typeof value}`);
  }

  return { value: [box(Math.floor(value), { type: 'Integer', singleton: true })], context };
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
  signatures: [{

    name: 'floor',
    input: { type: 'Decimal', singleton: true },
    parameters: [],
    result: { type: 'Integer', singleton: true }
  }],
  evaluate
};