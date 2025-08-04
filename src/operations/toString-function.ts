import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // toString takes no arguments
  if (args.length !== 0) {
    throw new Error('toString() takes no arguments');
  }

  // If input is empty, return empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input has multiple items, signal an error
  if (input.length > 1) {
    throw new Error('toString() can only be used on single values');
  }

  const boxedInputValue = input[0];
  if (!boxedInputValue) {
    return { value: [], context };
  }
  
  const inputValue = unbox(boxedInputValue);

  // Handle different types according to the spec
  if (typeof inputValue === 'string') {
    // Already a string
    return { value: [box(inputValue, { type: 'String', singleton: true })], context };
  }
  
  if (typeof inputValue === 'number') {
    // Integer or Decimal
    return { value: [box(inputValue.toString(), { type: 'String', singleton: true })], context };
  }
  
  if (typeof inputValue === 'boolean') {
    // Boolean: true -> 'true', false -> 'false'
    return { value: [box(inputValue ? 'true' : 'false', { type: 'String', singleton: true })], context };
  }
  
  // Handle Date, Time, DateTime objects if they have specific properties
  if (inputValue && typeof inputValue === 'object') {
    // Check for Date type (YYYY-MM-DD format)
    if (inputValue.type === 'Date' && inputValue.value) {
      return { value: [box(inputValue.value, { type: 'String', singleton: true })], context };
    }
    
    // Check for DateTime type (YYYY-MM-DDThh:mm:ss.fff(+|-)hh:mm format)
    if (inputValue.type === 'DateTime' && inputValue.value) {
      return { value: [box(inputValue.value, { type: 'String', singleton: true })], context };
    }
    
    // Check for Time type (hh:mm:ss.fff(+|-)hh:mm format)
    if (inputValue.type === 'Time' && inputValue.value) {
      return { value: [box(inputValue.value, { type: 'String', singleton: true })], context };
    }
    
    // Check for Quantity type
    if (inputValue.type === 'Quantity' && inputValue.value !== undefined && inputValue.unit) {
      return { value: [box(`${inputValue.value} '${inputValue.unit}'`, { type: 'String', singleton: true })], context };
    }
  }
  
  // For any other type, return empty (not false as mentioned in spec - seems to be a typo)
  return { value: [], context };
};

export const toStringFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'toString',
  category: ['type-conversion'],
  description: 'Converts a single value to a String. Supports String, Integer, Decimal, Boolean, Date, Time, DateTime, and Quantity types. Returns empty for unsupported types. Signals an error for multiple input items.',
  examples: [
    "42.toString()",
    "true.toString()",
    "'hello'.toString()",
    "3.14.toString()"
  ],
  signature: {
    input: { type: 'Any', singleton: true },
    parameters: [],
    result: { type: 'String', singleton: true }
  },
  evaluate
};