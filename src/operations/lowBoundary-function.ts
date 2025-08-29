// lowBoundary() function - Returns the least possible value to the specified precision
import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { box, unbox } from '../interpreter/boxing';
import { 
  isFHIRDate, isFHIRDateTime, isFHIRTime,
  getDateLowBoundary, getDateTimeLowBoundary, getTimeLowBoundary 
} from '../complex-types/temporal';
import { getDecimalLowBoundary } from './decimal-boundaries';
import { Errors } from '../errors';

export const lowBoundaryEvaluator: FunctionEvaluator = async (input, context, args, evaluator) => {
  // lowBoundary() takes optional precision parameter
  if (args.length > 1) {
    throw Errors.wrongArgumentCountRange('lowBoundary', 0, 1, args.length);
  }
  
  // Empty input returns empty
  if (input.length === 0) {
    return { value: [], context };
  }
  
  // Multiple items throws error
  if (input.length > 1) {
    throw Errors.singletonRequired('lowBoundary', input.length);
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
      throw Errors.singletonRequired('lowBoundary precision', precisionArg.length);
    }
    const precisionValue = unbox(precisionArg[0]!);
    if (typeof precisionValue !== 'number' || !Number.isInteger(precisionValue)) {
      throw Errors.invalidOperandType('lowBoundary precision', typeof precisionValue);
    }
    precision = precisionValue;
  }
  
  // Handle Date
  if (isFHIRDate(value)) {
    const result = getDateLowBoundary(value, precision);
    if (!result) {
      return { value: [], context };
    }
    return { value: [box(result, { type: 'Date', singleton: true })], context };
  }
  
  // Handle DateTime
  if (isFHIRDateTime(value)) {
    const result = getDateTimeLowBoundary(value, precision);
    if (!result) {
      return { value: [], context };
    }
    return { value: [box(result, { type: 'DateTime', singleton: true })], context };
  }
  
  // Handle Time
  if (isFHIRTime(value)) {
    const result = getTimeLowBoundary(value, precision);
    if (!result) {
      return { value: [], context };
    }
    return { value: [box(result, { type: 'Time', singleton: true })], context };
  }
  
  // For Decimal/Integer types
  if (typeof value === 'number') {
    const result = getDecimalLowBoundary(value, precision);
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

export const lowBoundaryFunction: FunctionDefinition & { evaluate: typeof lowBoundaryEvaluator } = {
  name: 'lowBoundary',
  category: ['utility'],
  description: 'Returns the least possible value of the input to the specified precision',
  examples: [
    '@2014.lowBoundary(6)',
    '@2014-01-01T08.lowBoundary(17)',
    '@T10:30.lowBoundary(9)',
    '1.587.lowBoundary()',
    '1.587.lowBoundary(2)',
    '1.lowBoundary(0)'
  ],
  signatures: [
    {
      name: 'lowBoundary',
      input: { type: 'Any' as const, singleton: true },
      parameters: [
        { name: 'precision', type: { type: 'Integer' as const, singleton: true }, optional: true }
      ],
      result: { type: 'Any' as const, singleton: true }
    }
  ],
  evaluate: lowBoundaryEvaluator
};