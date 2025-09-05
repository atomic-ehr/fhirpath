import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../interpreter/boxing';
import { getDecimalPlaces } from '../utils/decimal';
import { isFHIRDate, isFHIRDateTime, isFHIRTime } from '../complex-types/temporal';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // Check single item in input
  if (input.length === 0) {
    return { value: [], context };
  }
  
  if (input.length > 1) {
    throw Errors.singletonRequired('precision', input.length);
  }

  const boxedInputValue = input[0];
  if (!boxedInputValue) {
    return { value: [], context };
  }
  
  const inputValue = unbox(boxedInputValue);

  // precision() takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('precision', 0, args.length);
  }

  // Handle temporal types - return precision according to FHIRPath spec
  if (isFHIRDate(inputValue)) {
    const date = inputValue as any;
    // Date precision: year=4, year-month=6, year-month-day=8
    if (date.day !== undefined) {
      return { value: [box(8, { type: 'Integer', singleton: true })], context };
    } else if (date.month !== undefined) {
      return { value: [box(6, { type: 'Integer', singleton: true })], context };
    } else {
      return { value: [box(4, { type: 'Integer', singleton: true })], context };
    }
  }
  
  if (isFHIRDateTime(inputValue)) {
    const dateTime = inputValue as any;
    // DateTime precision: year=4, month=6, day=8, hour=10, minute=12, second=14, millisecond=17
    if (dateTime.millisecond !== undefined) {
      return { value: [box(17, { type: 'Integer', singleton: true })], context };
    } else if (dateTime.second !== undefined) {
      return { value: [box(14, { type: 'Integer', singleton: true })], context };
    } else if (dateTime.minute !== undefined) {
      return { value: [box(12, { type: 'Integer', singleton: true })], context };
    } else if (dateTime.hour !== undefined) {
      return { value: [box(10, { type: 'Integer', singleton: true })], context };
    } else if (dateTime.day !== undefined) {
      return { value: [box(8, { type: 'Integer', singleton: true })], context };
    } else if (dateTime.month !== undefined) {
      return { value: [box(6, { type: 'Integer', singleton: true })], context };
    } else {
      return { value: [box(4, { type: 'Integer', singleton: true })], context };
    }
  }
  
  if (isFHIRTime(inputValue)) {
    const time = inputValue as any;
    // Time precision: hour=2, minute=4, second=6, millisecond=9
    // But spec shows hour=4, minute=4, second=6, millisecond=9
    // Looking at examples: @T10:30 has "10:30" which is 4 characters for HH:mm
    // @T10:30:00.000 has milliseconds which would be 9 for HH:mm:ss.fff
    if (time.millisecond !== undefined) {
      return { value: [box(9, { type: 'Integer', singleton: true })], context };
    } else if (time.second !== undefined) {
      return { value: [box(6, { type: 'Integer', singleton: true })], context };
    } else if (time.minute !== undefined) {
      return { value: [box(4, { type: 'Integer', singleton: true })], context };
    } else {
      // Hour only would be 2 (HH)
      return { value: [box(2, { type: 'Integer', singleton: true })], context };
    }
  }
  
  // Handle decimal/numeric types
  if (typeof inputValue === 'number') {
    // For integers, precision is always 0
    if (Number.isInteger(inputValue)) {
      return { value: [box(0, { type: 'Integer', singleton: true })], context };
    }
    
    // For decimals, count significant digits after the decimal point
    const decimalPlaces = getDecimalPlaces(inputValue);
    return { value: [box(decimalPlaces, { type: 'Integer', singleton: true })], context };
  }
  
  // For any other type, return empty
  return { value: [], context };
};

export const precisionFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'precision',
  category: ['utility'],
  description: 'Returns the number of digits of precision for decimal values, or the precision indicator for temporal values (year=4, month=6, day=8, etc.). Returns empty for other types.',
  examples: [
    "1.58700.precision()",
    "@2014.precision()",
    "@2014-01-05T10:30:00.000.precision()",
    "@T10:30.precision()",
    "{}.precision()"
  ],
  signatures: [
    {
      name: 'precision',
      input: { type: 'Decimal', singleton: true },
      parameters: [],
      result: { type: 'Integer', singleton: true }
    },
    {
      name: 'precision',
      input: { type: 'Integer', singleton: true },
      parameters: [],
      result: { type: 'Integer', singleton: true }
    },
    {
      name: 'precision',
      input: { type: 'Date', singleton: true },
      parameters: [],
      result: { type: 'Integer', singleton: true }
    },
    {
      name: 'precision',
      input: { type: 'DateTime', singleton: true },
      parameters: [],
      result: { type: 'Integer', singleton: true }
    },
    {
      name: 'precision',
      input: { type: 'Time', singleton: true },
      parameters: [],
      result: { type: 'Integer', singleton: true }
    },
    {
      name: 'precision',
      input: { type: 'Any', singleton: true },
      parameters: [],
      result: { type: 'Integer', singleton: false }
    }
  ],
  evaluate
};