// secondOf() function - Extracts second component from Time or DateTime
import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { box, unbox } from '../interpreter/boxing';
import { isFHIRTime, isFHIRDateTime } from '../complex-types/temporal';
import { Errors } from '../errors';

export const secondOfEvaluator: FunctionEvaluator = async (input, context, args) => {
  // secondOf() takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('secondOf', 0, args.length);
  }
  
  // Empty input returns empty
  if (input.length === 0) {
    return { value: [], context };
  }
  
  // Multiple items throws error
  if (input.length > 1) {
    throw Errors.singletonRequired('secondOf', input.length);
  }
  
  const boxedValue = input[0];
  if (!boxedValue) {
    return { value: [], context };
  }
  
  const value = unbox(boxedValue);
  
  // Check if it's a Time or DateTime
  if (isFHIRTime(value) || isFHIRDateTime(value)) {
    // Check if second component is present
    if (value.second === undefined) {
      return { value: [], context };
    }
    
    // Return the second as an Integer (0-59)
    return {
      value: [box(value.second, { type: 'Integer', singleton: true })],
      context
    };
  }
  
  // Not a Time or DateTime, return empty
  return { value: [], context };
};

export const secondOfFunction: FunctionDefinition & { evaluate: typeof secondOfEvaluator } = {
  name: 'secondOf',
  category: ['temporal'],
  description: 'Returns the second component of a Time or DateTime value (0-59)',
  examples: [
    '@T10:30:45.secondOf()',
    '@2014-01-05T10:30:45.secondOf()',
    'Observation.effectiveDateTime.secondOf()'
  ],
  signatures: [
    {
      name: 'secondOf',
      input: { type: 'Any', singleton: true },
      parameters: [],
      result: { type: 'Integer', singleton: true }
    }
  ],
  evaluate: secondOfEvaluator
};