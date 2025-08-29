// dayOf() function - Extracts day component from Date or DateTime
import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { box, unbox } from '../interpreter/boxing';
import { isFHIRDate, isFHIRDateTime } from '../complex-types/temporal';
import { Errors } from '../errors';

export const dayOfEvaluator: FunctionEvaluator = async (input, context, args) => {
  // dayOf() takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('dayOf', 0, args.length);
  }
  
  // Empty input returns empty
  if (input.length === 0) {
    return { value: [], context };
  }
  
  // Multiple items throws error
  if (input.length > 1) {
    throw Errors.singletonRequired('dayOf', input.length);
  }
  
  const boxedValue = input[0];
  if (!boxedValue) {
    return { value: [], context };
  }
  
  const value = unbox(boxedValue);
  
  // Check if it's a Date or DateTime
  if (isFHIRDate(value) || isFHIRDateTime(value)) {
    // Check if day component is present
    if (value.day === undefined) {
      return { value: [], context };
    }
    
    // Return the day as an Integer (1-31)
    return {
      value: [box(value.day, { type: 'Integer', singleton: true })],
      context
    };
  }
  
  // Not a Date or DateTime, return empty
  return { value: [], context };
};

export const dayOfFunction: FunctionDefinition & { evaluate: typeof dayOfEvaluator } = {
  name: 'dayOf',
  category: ['temporal'],
  description: 'Returns the day component of a Date or DateTime value (1-31)',
  examples: [
    '@2014-01-05.dayOf()',
    '@2014-01-05T10:30:00.dayOf()',
    'Patient.birthDate.dayOf()'
  ],
  signatures: [
    {
      name: 'dayOf',
      input: { type: 'Any', singleton: true },
      parameters: [],
      result: { type: 'Integer', singleton: true }
    }
  ],
  evaluate: dayOfEvaluator
};