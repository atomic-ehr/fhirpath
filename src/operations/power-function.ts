import type { FunctionDefinition, FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // power() takes exactly one argument (exponent)
  if (args.length !== 1) {
    throw new Error('power() requires exactly 1 argument');
  }

  // If input is empty, return empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input has multiple items, error
  if (input.length > 1) {
    throw new Error('power() can only be applied to a single item');
  }

  const base = input[0];

  // Base must be a number
  if (typeof base !== 'number') {
    throw new Error(`Cannot apply power() to ${typeof base}`);
  }

  // Evaluate exponent
  const exponentResult = evaluator(args[0]!, input, context);
  if (exponentResult.value.length === 0) {
    return { value: [], context };
  }
  if (exponentResult.value.length > 1) {
    throw new Error('power() exponent must be a single value');
  }

  const exponent = exponentResult.value[0];
  if (typeof exponent !== 'number') {
    throw new Error('power() exponent must be a number');
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
    return { value: [result], context };
  }

  return { value: [result], context };
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
  signature: {
    input: { type: 'Decimal', singleton: true },
    parameters: [
      { name: 'exponent', type: { type: 'Decimal', singleton: true }, optional: false }
    ],
    result: { type: 'Decimal', singleton: true }
  },
  evaluate
};