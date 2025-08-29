import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // convertsToString() takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('convertsToString', 0, args.length);
  }

  // If input collection is empty, result is empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input collection contains multiple items, signal an error
  if (input.length > 1) {
    throw Errors.singletonRequired('convertsToString', input.length);
  }

  const boxedInputValue = input[0];
  if (!boxedInputValue) {
    return { value: [box(false, { type: 'Boolean', singleton: true })], context };
  }
  
  const inputValue = unbox(boxedInputValue);

  // Check if the value can be converted to String
  
  // String - always convertible
  if (typeof inputValue === 'string') {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }
  
  // Integer or Decimal - always convertible
  if (typeof inputValue === 'number') {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }
  
  // Boolean - always convertible
  if (typeof inputValue === 'boolean') {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }
  
  // Check for temporal types (Date, Time, DateTime) - these are convertible
  if (inputValue && typeof inputValue === 'object') {
    // Check if it has type property indicating temporal type
    const objWithType = inputValue as any;
    if (objWithType.type === 'Date' || objWithType.type === 'DateTime' || objWithType.type === 'Time') {
      return { value: [box(true, { type: 'Boolean', singleton: true })], context };
    }
    
    // Check boxed type info
    const typeInfo = boxedInputValue.typeInfo;
    if (typeInfo?.type === 'Date' || typeInfo?.type === 'DateTime' || typeInfo?.type === 'Time') {
      return { value: [box(true, { type: 'Boolean', singleton: true })], context };
    }
    
    // Check for Quantity type
    if (objWithType.type === 'Quantity' || typeInfo?.type === 'Quantity') {
      return { value: [box(true, { type: 'Boolean', singleton: true })], context };
    }
  }

  // For complex objects and other types, return false
  return { value: [box(false, { type: 'Boolean', singleton: true })], context };
};

export const convertsToStringFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'convertsToString',
  category: ['type-conversion'],
  description: 'Returns true if the input can be converted to a String. Returns true for: String (any), Integer (any), Decimal (any), Boolean (any), Date, DateTime, Time, Quantity. Returns false for complex objects and resources.',
  examples: [
    "'test'.convertsToString()",
    "42.convertsToString()",
    "true.convertsToString()",
    "Patient.convertsToString()"
  ],
  signatures: [
    {
      name: 'convertsToString',
      input: { type: 'Any', singleton: true },
      parameters: [],
      result: { type: 'Boolean', singleton: true }
    }
  ],
  evaluate
};