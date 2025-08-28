// yearOf() function - Extracts year component from Date or DateTime
import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';
import { isFHIRDate, isFHIRDateTime } from '../temporal';
import { Errors } from '../errors';

export const yearOfEvaluator: FunctionEvaluator = async (input, context, args) => {
  // yearOf() takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('yearOf', 0, args.length);
  }
  
  // Empty input returns empty
  if (input.length === 0) {
    return { value: [], context };
  }
  
  // Multiple items throws error
  if (input.length > 1) {
    throw Errors.singletonRequired('yearOf', input.length);
  }
  
  const boxedValue = input[0];
  if (!boxedValue) {
    return { value: [], context };
  }
  
  const value = unbox(boxedValue);
  
  // Check if it's a Date or DateTime
  if (isFHIRDate(value) || isFHIRDateTime(value)) {
    // Check if year component is present
    if (value.year === undefined) {
      return { value: [], context };
    }
    
    // Return the year as an Integer
    return {
      value: [box(value.year, { type: 'Integer', singleton: true })],
      context
    };
  }
  
  // Not a Date or DateTime, return empty
  return { value: [], context };
};

export const yearOfFunction: FunctionDefinition & { evaluate: typeof yearOfEvaluator } = {
  name: 'yearOf',
  category: ['temporal'],
  description: 'Returns the year component of a Date or DateTime value',
  examples: [
    '@2014-01-05.yearOf()',
    '@2014-01-05T10:30:00.yearOf()',
    'Patient.birthDate.yearOf()'
  ],
  signatures: [
    {
      name: 'yearOf',
      input: { type: 'Any', singleton: true },
      parameters: [],
      result: { type: 'Integer', singleton: true }
    }
  ],
  evaluate: yearOfEvaluator
};