import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../interpreter/boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // exp() takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('exp', 0, args.length);
  }

  // If input is empty, return empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input has multiple items, error
  if (input.length > 1) {
    throw Errors.singletonRequired('exp', input.length);
  }

  const boxedValue = input[0];
  if (!boxedValue) return { value: [], context };
  const value = unbox(boxedValue);

  // Must be a number
  if (typeof value !== 'number') {
    throw Errors.invalidOperandType('exp', `${typeof value}`);
  }

  // Calculate e^value
  const result = Math.exp(value);
  
  // Check for overflow (JavaScript returns Infinity for very large exponents)
  if (!isFinite(result)) {
    throw Errors.invalidOperation('exp() result is too large to represent');
  }

  return { value: [box(result, { type: 'Decimal', singleton: true })], context };
};

export const expFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'exp',
  category: ['math'],
  description: 'Returns e raised to the power of the input number (e^x) as a Decimal.',
  examples: [
    '0.exp()',
    '1.exp()',
    '(-1).exp()'
  ],
  signatures: [
    {
      name: 'exp-integer',
      input: { type: 'Integer', singleton: true },
      parameters: [],
      result: { type: 'Decimal', singleton: true }
    },
    {
      name: 'exp-decimal',
      input: { type: 'Decimal', singleton: true },
      parameters: [],
      result: { type: 'Decimal', singleton: true }
    }
  ],
  evaluate
};