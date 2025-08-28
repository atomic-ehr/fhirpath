// highBoundary() function - Returns the greatest possible value to the specified precision
import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';
import { 
  isFHIRDate, isFHIRDateTime, isFHIRTime,
  getDateHighBoundary, getDateTimeHighBoundary, getTimeHighBoundary 
} from '../temporal';
import { getDecimalHighBoundary } from '../decimal-boundaries';
import { Errors } from '../errors';

export const highBoundaryEvaluator: FunctionEvaluator = async (input, context, args, evaluator) => {
  // highBoundary() takes optional precision parameter
  if (args.length > 1) {
    throw Errors.wrongArgumentCountRange('highBoundary', 0, 1, args.length);
  }
  
  // Empty input returns empty
  if (input.length === 0) {
    return { value: [], context };
  }
  
  // Multiple items throws error
  if (input.length > 1) {
    throw Errors.singletonRequired('highBoundary', input.length);
  }
  
  const boxedValue = input[0];
  if (!boxedValue) {
    return { value: [], context };
  }
  
  const value = unbox(boxedValue);
  
  // Get precision if provided
  let precision: number | undefined;
  if (args.length === 1) {
    const precisionResult = await evaluator(args[0]!, input, context);
    const precisionArg = precisionResult.value;
    if (precisionArg.length === 0) {
      return { value: [], context };
    }
    if (precisionArg.length > 1) {
      throw Errors.singletonRequired('highBoundary precision', precisionArg.length);
    }
    const precisionValue = unbox(precisionArg[0]!);
    if (typeof precisionValue !== 'number' || !Number.isInteger(precisionValue)) {
      throw Errors.invalidOperandType('highBoundary precision', typeof precisionValue);
    }
    precision = precisionValue;
  }
  
  // Handle Date
  if (isFHIRDate(value)) {
    const result = getDateHighBoundary(value, precision);
    if (!result) {
      return { value: [], context };
    }
    return { value: [box(result, { type: 'Date', singleton: true })], context };
  }
  
  // Handle DateTime
  if (isFHIRDateTime(value)) {
    const result = getDateTimeHighBoundary(value, precision);
    if (!result) {
      return { value: [], context };
    }
    return { value: [box(result, { type: 'DateTime', singleton: true })], context };
  }
  
  // Handle Time
  if (isFHIRTime(value)) {
    const result = getTimeHighBoundary(value, precision);
    if (!result) {
      return { value: [], context };
    }
    return { value: [box(result, { type: 'Time', singleton: true })], context };
  }
  
  // For Decimal/Integer types
  if (typeof value === 'number') {
    const result = getDecimalHighBoundary(value, precision);
    if (result === null) {
      return { value: [], context };
    }
    // Determine the result type based on whether it's an integer or decimal
    const isInteger = Number.isInteger(result);
    return { 
      value: [box(result, { type: isInteger ? 'Integer' : 'Decimal', singleton: true })], 
      context 
    };
  }
  
  // Invalid type returns empty
  return { value: [], context };
};

export const highBoundaryFunction: FunctionDefinition & { evaluate: typeof highBoundaryEvaluator } = {
  name: 'highBoundary',
  category: ['utility'],
  description: 'Returns the greatest possible value of the input to the specified precision',
  examples: [
    '@2014.highBoundary(6)',
    '@2014-01-01T08.highBoundary(17)',
    '@T10:30.highBoundary(9)',
    '1.587.highBoundary()',
    '1.587.highBoundary(2)',
    '1.highBoundary(0)'
  ],
  signatures: [
    {
      name: 'highBoundary',
      input: { type: 'Any' as const, singleton: true },
      parameters: [
        { name: 'precision', type: { type: 'Integer' as const, singleton: true }, optional: true }
      ],
      result: { type: 'Any' as const, singleton: true }
    }
  ],
  evaluate: highBoundaryEvaluator
};