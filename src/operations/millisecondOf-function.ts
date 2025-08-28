// millisecondOf() function - Extracts millisecond component from Time or DateTime
import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';
import { isFHIRTime, isFHIRDateTime } from '../temporal';
import { Errors } from '../errors';

export const millisecondOfEvaluator: FunctionEvaluator = async (input, context, args) => {
  // millisecondOf() takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('millisecondOf', 0, args.length);
  }
  
  // Empty input returns empty
  if (input.length === 0) {
    return { value: [], context };
  }
  
  // Multiple items throws error
  if (input.length > 1) {
    throw Errors.singletonRequired('millisecondOf', input.length);
  }
  
  const boxedValue = input[0];
  if (!boxedValue) {
    return { value: [], context };
  }
  
  const value = unbox(boxedValue);
  
  // Check if it's a Time or DateTime
  if (isFHIRTime(value) || isFHIRDateTime(value)) {
    // Check if millisecond component is present
    if (value.millisecond === undefined) {
      return { value: [], context };
    }
    
    // Return the millisecond as an Integer (0-999)
    return {
      value: [box(value.millisecond, { type: 'Integer', singleton: true })],
      context
    };
  }
  
  // Not a Time or DateTime, return empty
  return { value: [], context };
};

export const millisecondOfFunction: FunctionDefinition & { evaluate: typeof millisecondOfEvaluator } = {
  name: 'millisecondOf',
  category: ['temporal'],
  description: 'Returns the millisecond component of a Time or DateTime value (0-999)',
  examples: [
    '@T10:30:45.123.millisecondOf()',
    '@2014-01-05T10:30:45.500.millisecondOf()',
    'Observation.effectiveDateTime.millisecondOf()'
  ],
  signatures: [
    {
      name: 'millisecondOf',
      input: { type: 'Any', singleton: true },
      parameters: [],
      result: { type: 'Integer', singleton: true }
    }
  ],
  evaluate: millisecondOfEvaluator
};