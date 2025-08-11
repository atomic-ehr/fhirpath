import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // ceiling() takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('ceiling', 0, args.length);
  }

  // If input is empty, return empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input has multiple items, error
  if (input.length > 1) {
    throw Errors.singletonRequired('ceiling', input.length);
  }

  const boxedValue = input[0];
  if (!boxedValue) return { value: [], context };
  const value = unbox(boxedValue);

  // Must be a number
  if (typeof value !== 'number') {
    throw Errors.invalidOperandType('ceiling', `${typeof value}`);
  }

  // Math.ceil can return -0, normalize it to 0
  const result = Math.ceil(value);
  return { value: [box(Object.is(result, -0) ? 0 : result, { type: 'Integer', singleton: true })], context };
};

export const ceilingFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'ceiling',
  category: ['math'],
  description: 'Returns the first integer greater than or equal to the input.',
  examples: [
    '1.ceiling()',
    '1.1.ceiling()',
    '(-1.1).ceiling()'
  ],
  signatures: [{

    name: 'ceiling',
    input: { type: 'Decimal', singleton: true },
    parameters: [],
    result: { type: 'Integer', singleton: true }
  }],
  evaluate
};