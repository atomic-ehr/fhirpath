// hourOf() function - Extracts hour component from Time or DateTime
import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { box, unbox } from '../interpreter/boxing';
import { isFHIRTime, isFHIRDateTime } from '../complex-types/temporal';
import { Errors } from '../errors';

export const hourOfEvaluator: FunctionEvaluator = async (input, context, args) => {
  // hourOf() takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('hourOf', 0, args.length);
  }
  
  // Empty input returns empty
  if (input.length === 0) {
    return { value: [], context };
  }
  
  // Multiple items throws error
  if (input.length > 1) {
    throw Errors.singletonRequired('hourOf', input.length);
  }
  
  const boxedValue = input[0];
  if (!boxedValue) {
    return { value: [], context };
  }
  
  const value = unbox(boxedValue);
  
  // Check if it's a Time or DateTime
  if (isFHIRTime(value) || isFHIRDateTime(value)) {
    // Check if hour component is present
    if (value.hour === undefined) {
      return { value: [], context };
    }
    
    // Return the hour as an Integer (0-23)
    return {
      value: [box(value.hour, { type: 'Integer', singleton: true })],
      context
    };
  }
  
  // Not a Time or DateTime, return empty
  return { value: [], context };
};

export const hourOfFunction: FunctionDefinition & { evaluate: typeof hourOfEvaluator } = {
  name: 'hourOf',
  category: ['temporal'],
  description: 'Returns the hour component of a Time or DateTime value (0-23)',
  examples: [
    '@T10:30:00.hourOf()',
    '@2014-01-05T10:30:00.hourOf()',
    'Patient.birthDate.hourOf()'
  ],
  signatures: [
    {
      name: 'hourOf',
      input: { type: 'Any', singleton: true },
      parameters: [],
      result: { type: 'Integer', singleton: true }
    }
  ],
  evaluate: hourOfEvaluator
};