// dateOf() function - Extracts date component from Date or DateTime
import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';
import { createDate, isFHIRDate, isFHIRDateTime } from '../temporal';
import { Errors } from '../errors';

export const dateOfEvaluator: FunctionEvaluator = async (input, context, args) => {
  // dateOf() takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('dateOf', 0, args.length);
  }
  
  // Empty input returns empty
  if (input.length === 0) {
    return { value: [], context };
  }
  
  // Multiple items throws error
  if (input.length > 1) {
    throw Errors.singletonRequired('dateOf', input.length);
  }
  
  const boxedValue = input[0];
  if (!boxedValue) {
    return { value: [], context };
  }
  
  const value = unbox(boxedValue);
  
  // Check if it's a Date or DateTime
  if (isFHIRDate(value)) {
    // Already a Date, return as-is
    return {
      value: [box(value, { type: 'Date', singleton: true })],
      context
    };
  }
  
  if (isFHIRDateTime(value)) {
    // Extract date component (preserve precision)
    const date = createDate(value.year, value.month, value.day);
    return {
      value: [box(date, { type: 'Date', singleton: true })],
      context
    };
  }
  
  // Not a Date or DateTime, return empty
  return { value: [], context };
};

export const dateOfFunction: FunctionDefinition & { evaluate: typeof dateOfEvaluator } = {
  name: 'dateOf',
  category: ['temporal'],
  description: 'Returns the date component of a Date or DateTime value',
  examples: [
    '@2012-01-01T12:30:00.dateOf()',
    'Patient.birthDate.dateOf()'
  ],
  signatures: [
    {
      name: 'dateOf',
      input: { type: 'Any', singleton: true },
      parameters: [],
      result: { type: 'Date', singleton: true }
    }
  ],
  evaluate: dateOfEvaluator
};