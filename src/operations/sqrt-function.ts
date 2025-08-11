import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // sqrt() takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('sqrt', 0, args.length);
  }

  // If input is empty, return empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input has multiple items, error
  if (input.length > 1) {
    throw Errors.singletonRequired('sqrt', input.length);
  }

  const boxedValue = input[0];
  if (!boxedValue) return { value: [], context };
  const value = unbox(boxedValue);

  // Must be a number
  if (typeof value !== 'number') {
    throw Errors.invalidOperandType('sqrt', `${typeof value}`);
  }

  // If negative, return empty (cannot represent square root of negative)
  if (value < 0) {
    return { value: [], context };
  }

  return { value: [box(Math.sqrt(value), { type: 'Decimal', singleton: true })], context };
};

export const sqrtFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'sqrt',
  category: ['math'],
  description: 'Returns the square root of the input number as a Decimal.',
  examples: [
    '81.sqrt()',
    '(-1).sqrt()'
  ],
  signatures: [{

    name: 'sqrt',
    input: { type: 'Decimal', singleton: true },
    parameters: [],
    result: { type: 'Decimal', singleton: true }
  }],
  evaluate
};