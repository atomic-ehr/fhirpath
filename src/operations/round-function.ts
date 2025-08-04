import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // round() takes 0 or 1 argument (precision)
  if (args.length > 1) {
    throw new Error('round() takes at most 1 argument');
  }

  // If input is empty, return empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input has multiple items, error
  if (input.length > 1) {
    throw new Error('round() can only be applied to a single item');
  }

  const boxedValue = input[0];
  if (!boxedValue) return { value: [], context };
  const value = unbox(boxedValue);

  // Must be a number
  if (typeof value !== 'number') {
    throw new Error(`Cannot apply round() to ${typeof value}`);
  }

  // Get precision if provided
  let precision = 0;
  if (args.length === 1) {
    const precisionResult = evaluator(args[0]!, input, context);
    if (precisionResult.value.length === 0) {
      return { value: [], context };
    }
    if (precisionResult.value.length > 1) {
      throw new Error('round() precision must be a single value');
    }
    const boxedPrecision = precisionResult.value[0];
    if (!boxedPrecision) {
      return { value: [], context };
    }
    precision = unbox(boxedPrecision);
    if (!Number.isInteger(precision) || precision < 0) {
      throw new Error('round() precision must be a non-negative integer');
    }
  }

  // Round to specified precision
  // FHIRPath uses "traditional round" where 0.5 rounds away from zero
  const multiplier = Math.pow(10, precision);
  const scaled = value * multiplier;
  
  let rounded: number;
  if (scaled >= 0) {
    rounded = Math.floor(scaled + 0.5);
  } else {
    rounded = Math.ceil(scaled - 0.5);
  }
  
  const result = rounded / multiplier;
  
  // If precision is 0 and result is a whole number, return as integer
  if (precision === 0 && Number.isInteger(result)) {
    return { value: [box(result, { type: 'Integer', singleton: true })], context };
  }
  
  return { value: [box(result, { type: 'Decimal', singleton: true })], context };
};

export const roundFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'round',
  category: ['math'],
  description: 'Rounds the decimal to the nearest whole number using a traditional round (i.e. 0.5 or higher will round to 1). If specified, the precision argument determines the decimal place at which the rounding will occur.',
  examples: [
    '1.round()',
    '3.14159.round(3)'
  ],
  signature: {
    input: { type: 'Decimal', singleton: true },
    parameters: [
      { name: 'precision', type: { type: 'Integer', singleton: true }, optional: true }
    ],
    result: { type: 'Decimal', singleton: true }
  },
  evaluate
};