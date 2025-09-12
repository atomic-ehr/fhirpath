import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../interpreter/boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // ln() takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('ln', 0, args.length);
  }

  // If input is empty, return empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input has multiple items, error
  if (input.length > 1) {
    throw Errors.singletonRequired('ln', input.length);
  }

  const boxedValue = input[0];
  if (!boxedValue) return { value: [], context };
  const value = unbox(boxedValue);

  // Must be a number
  if (typeof value !== 'number') {
    throw Errors.invalidOperandType('ln', `${typeof value}`);
  }

  // If zero or negative, return empty (ln is undefined for non-positive numbers)
  if (value <= 0) {
    return { value: [], context };
  }

  return { value: [box(Math.log(value), { type: 'Decimal', singleton: true })], context };
};

export const lnFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'ln',
  category: ['math'],
  description: 'Returns the natural logarithm (base e) of the input number as a Decimal.',
  examples: [
    '1.ln()',
    '2.71828.ln()',
    '(-1).ln()'
  ],
  signatures: [
    {
      name: 'ln-integer',
      input: { type: 'Integer', singleton: true },
      parameters: [],
      result: { type: 'Decimal', singleton: true }
    },
    {
      name: 'ln-decimal',
      input: { type: 'Decimal', singleton: true },
      parameters: [],
      result: { type: 'Decimal', singleton: true }
    }
  ],
  evaluate
};