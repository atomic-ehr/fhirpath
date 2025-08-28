// minuteOf() function - Extracts minute component from Time or DateTime
import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';
import { isFHIRTime, isFHIRDateTime } from '../temporal';
import { Errors } from '../errors';

export const minuteOfEvaluator: FunctionEvaluator = async (input, context, args) => {
  // minuteOf() takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('minuteOf', 0, args.length);
  }
  
  // Empty input returns empty
  if (input.length === 0) {
    return { value: [], context };
  }
  
  // Multiple items throws error
  if (input.length > 1) {
    throw Errors.singletonRequired('minuteOf', input.length);
  }
  
  const boxedValue = input[0];
  if (!boxedValue) {
    return { value: [], context };
  }
  
  const value = unbox(boxedValue);
  
  // Check if it's a Time or DateTime
  if (isFHIRTime(value) || isFHIRDateTime(value)) {
    // Check if minute component is present
    if (value.minute === undefined) {
      return { value: [], context };
    }
    
    // Return the minute as an Integer (0-59)
    return {
      value: [box(value.minute, { type: 'Integer', singleton: true })],
      context
    };
  }
  
  // Not a Time or DateTime, return empty
  return { value: [], context };
};

export const minuteOfFunction: FunctionDefinition & { evaluate: typeof minuteOfEvaluator } = {
  name: 'minuteOf',
  category: ['temporal'],
  description: 'Returns the minute component of a Time or DateTime value (0-59)',
  examples: [
    '@T10:30:00.minuteOf()',
    '@2014-01-05T10:30:00.minuteOf()',
    'Observation.effectiveDateTime.minuteOf()'
  ],
  signatures: [
    {
      name: 'minuteOf',
      input: { type: 'Any', singleton: true },
      parameters: [],
      result: { type: 'Integer', singleton: true }
    }
  ],
  evaluate: minuteOfEvaluator
};