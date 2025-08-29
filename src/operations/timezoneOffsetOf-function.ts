// timezoneOffsetOf() function - Extracts timezone offset component from DateTime
import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { box, unbox } from '../interpreter/boxing';
import { isFHIRDateTime } from '../complex-types/temporal';
import { Errors } from '../errors';

export const timezoneOffsetOfEvaluator: FunctionEvaluator = async (input, context, args) => {
  // timezoneOffsetOf() takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('timezoneOffsetOf', 0, args.length);
  }
  
  // Empty input returns empty
  if (input.length === 0) {
    return { value: [], context };
  }
  
  // Multiple items throws error
  if (input.length > 1) {
    throw Errors.singletonRequired('timezoneOffsetOf', input.length);
  }
  
  const boxedValue = input[0];
  if (!boxedValue) {
    return { value: [], context };
  }
  
  const value = unbox(boxedValue);
  
  // Check if it's a DateTime with timezone
  if (isFHIRDateTime(value)) {
    // Check if timezone offset is present
    if (value.timezoneOffset === undefined) {
      return { value: [], context };
    }
    
    // Return the timezone offset as a Decimal (hours)
    // The timezoneOffset is stored in minutes, convert to decimal hours
    const offsetInHours = value.timezoneOffset / 60;
    
    return {
      value: [box(offsetInHours, { type: 'Decimal', singleton: true })],
      context
    };
  }
  
  // Not a DateTime, return empty
  return { value: [], context };
};

export const timezoneOffsetOfFunction: FunctionDefinition & { evaluate: typeof timezoneOffsetOfEvaluator } = {
  name: 'timezoneOffsetOf',
  category: ['temporal'],
  description: 'Returns the timezone offset component of a DateTime value as decimal hours',
  examples: [
    '@2012-01-01T12:30:00.000-07:00.timezoneOffsetOf()',
    '@2012-01-01T12:30:00.000+05:30.timezoneOffsetOf()',
    'Patient.lastUpdated.timezoneOffsetOf()'
  ],
  signatures: [
    {
      name: 'timezoneOffsetOf',
      input: { type: 'Any', singleton: true },
      parameters: [],
      result: { type: 'Decimal', singleton: true }
    }
  ],
  evaluate: timezoneOffsetOfEvaluator
};