// monthOf() function - Extracts month component from Date or DateTime
import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';
import { isFHIRDate, isFHIRDateTime } from '../temporal';
import { Errors } from '../errors';

export const monthOfEvaluator: FunctionEvaluator = async (input, context, args) => {
  // monthOf() takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('monthOf', 0, args.length);
  }
  
  // Empty input returns empty
  if (input.length === 0) {
    return { value: [], context };
  }
  
  // Multiple items throws error
  if (input.length > 1) {
    throw Errors.singletonRequired('monthOf', input.length);
  }
  
  const boxedValue = input[0];
  if (!boxedValue) {
    return { value: [], context };
  }
  
  const value = unbox(boxedValue);
  
  // Check if it's a Date or DateTime
  if (isFHIRDate(value) || isFHIRDateTime(value)) {
    // Check if month component is present
    if (value.month === undefined) {
      return { value: [], context };
    }
    
    // Return the month as an Integer (1-12)
    return {
      value: [box(value.month, { type: 'Integer', singleton: true })],
      context
    };
  }
  
  // Not a Date or DateTime, return empty
  return { value: [], context };
};

export const monthOfFunction: FunctionDefinition & { evaluate: typeof monthOfEvaluator } = {
  name: 'monthOf',
  category: ['temporal'],
  description: 'Returns the month component of a Date or DateTime value (1-12)',
  examples: [
    '@2014-01-05.monthOf()',
    '@2014-01-05T10:30:00.monthOf()',
    'Patient.birthDate.monthOf()'
  ],
  signatures: [
    {
      name: 'monthOf',
      input: { type: 'Any', singleton: true },
      parameters: [],
      result: { type: 'Integer', singleton: true }
    }
  ],
  evaluate: monthOfEvaluator
};