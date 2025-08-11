import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // power() takes exactly one argument (exponent)
  if (args.length !== 1) {
    throw Errors.wrongArgumentCount('power', 1, args.length);
  }

  // If input is empty, return empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input has multiple items, error
  if (input.length > 1) {
    throw Errors.singletonRequired('power', input.length);
  }

  const boxedBase = input[0];
  if (!boxedBase) {
    return { value: [], context };
  }
  
  const base = unbox(boxedBase);

  // Base must be a number
  if (typeof base !== 'number') {
    throw Errors.invalidOperandType('power', `${typeof base}`);
  }

  // Evaluate exponent
  const exponentResult = await evaluator(args[0]!, input, context);
  if (exponentResult.value.length === 0) {
    return { value: [], context };
  }
  if (exponentResult.value.length > 1) {
    throw Errors.invalidOperation('power exponent must be a single value');
  }

  const boxedExponent = exponentResult.value[0];
  if (!boxedExponent) {
    return { value: [], context };
  }
  
  const exponent = unbox(boxedExponent);
  if (typeof exponent !== 'number') {
    throw Errors.invalidOperation('power exponent must be a number');
  }

  // Calculate power
  const result = Math.pow(base, exponent);

  // Check if result is valid (not NaN)
  if (isNaN(result)) {
    // Power cannot be represented (e.g., (-1)^0.5)
    return { value: [], context };
  }

  // If both inputs are integers and result is a whole number, return as integer
  if (Number.isInteger(base) && Number.isInteger(exponent) && Number.isInteger(result)) {
    return { value: [box(result, { type: 'Integer', singleton: true })], context };
  }

  return { value: [box(result, { type: 'Decimal', singleton: true })], context };
};

export const powerFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'power',
  category: ['math'],
  description: 'Raises a number to the exponent power. If this function is used with Integers, the result is an Integer. If the function is used with Decimals, the result is a Decimal.',
  examples: [
    '2.power(3)',
    '2.5.power(2)',
    '(-1).power(0.5)'
  ],
  signatures: [{

    name: 'power',
    input: { type: 'Decimal', singleton: true },
    parameters: [
      { name: 'exponent', type: { type: 'Decimal', singleton: true }, optional: false }
    ],
    result: { type: 'Decimal', singleton: true }
  }],
  evaluate
};