// timeOf() function - Extracts time component from DateTime
import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { box, unbox } from '../interpreter/boxing';
import { createTime, isFHIRDateTime } from '../complex-types/temporal';
import { Errors } from '../errors';

export const timeOfEvaluator: FunctionEvaluator = async (input, context, args) => {
  // timeOf() takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('timeOf', 0, args.length);
  }
  
  // Empty input returns empty
  if (input.length === 0) {
    return { value: [], context };
  }
  
  // Multiple items throws error
  if (input.length > 1) {
    throw Errors.singletonRequired('timeOf', input.length);
  }
  
  const boxedValue = input[0];
  if (!boxedValue) {
    return { value: [], context };
  }
  
  const value = unbox(boxedValue);
  
  // Check if it's a DateTime
  if (isFHIRDateTime(value)) {
    // Check if time component is present
    if (value.hour === undefined) {
      // No time component present
      return { value: [], context };
    }
    
    // Extract time component (preserve precision)
    const time = createTime(value.hour, value.minute, value.second, value.millisecond);
    return {
      value: [box(time, { type: 'Time', singleton: true })],
      context
    };
  }
  
  // Not a DateTime, return empty
  return { value: [], context };
};

export const timeOfFunction: FunctionDefinition & { evaluate: typeof timeOfEvaluator } = {
  name: 'timeOf',
  category: ['temporal'],
  description: 'Returns the time component of a DateTime value',
  examples: [
    '@2012-01-01T12:30:00.timeOf()',
    'Observation.effectiveDateTime.timeOf()'
  ],
  signatures: [
    {
      name: 'timeOf',
      input: { type: 'Any', singleton: true },
      parameters: [],
      result: { type: 'Time', singleton: true }
    }
  ],
  evaluate: timeOfEvaluator
};