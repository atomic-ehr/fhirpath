import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // convertsToBoolean() takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('convertsToBoolean', 0, args.length);
  }

  // If input collection is empty, result is empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input collection contains multiple items, signal an error
  if (input.length > 1) {
    throw Errors.singletonRequired('convertsToBoolean', input.length);
  }

  const boxedInputValue = input[0];
  if (!boxedInputValue) {
    return { value: [box(false, { type: 'Boolean', singleton: true })], context };
  }
  
  const inputValue = unbox(boxedInputValue);

  // Check if the value can be converted to Boolean
  
  // Boolean - always convertible
  if (typeof inputValue === 'boolean') {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }
  
  // Integer - 1 and 0 are convertible
  if (typeof inputValue === 'number' && Number.isInteger(inputValue)) {
    const canConvert = inputValue === 1 || inputValue === 0;
    return { value: [box(canConvert, { type: 'Boolean', singleton: true })], context };
  }
  
  // Decimal - 1.0 and 0.0 are convertible
  if (typeof inputValue === 'number' && !Number.isInteger(inputValue)) {
    const canConvert = inputValue === 1.0 || inputValue === 0.0;
    return { value: [box(canConvert, { type: 'Boolean', singleton: true })], context };
  }
  
  // String - check if it's a valid boolean representation (case insensitive)
  if (typeof inputValue === 'string') {
    const lowerValue = inputValue.toLowerCase();
    const validRepresentations = ['true', 't', 'yes', 'y', '1', '1.0', 'false', 'f', 'no', 'n', '0', '0.0'];
    const canConvert = validRepresentations.includes(lowerValue);
    return { value: [box(canConvert, { type: 'Boolean', singleton: true })], context };
  }

  // For all other types, return false
  return { value: [box(false, { type: 'Boolean', singleton: true })], context };
};

export const convertsToBooleanFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'convertsToBoolean',
  category: ['type-conversion'],
  description: 'Returns true if the input can be converted to a Boolean. Returns true for: Boolean (any), Integer (1 or 0), Decimal (1.0 or 0.0), String (\'true\'/\'t\'/\'yes\'/\'y\'/\'1\'/\'1.0\'/\'false\'/\'f\'/\'no\'/\'n\'/\'0\'/\'0.0\', case insensitive). Returns false for all other values.',
  examples: [
    "'true'.convertsToBoolean()",
    "'invalid'.convertsToBoolean()",
    "1.convertsToBoolean()",
    "2.convertsToBoolean()"
  ],
  signatures: [
    {
      name: 'convertsToBoolean',
      input: { type: 'Any', singleton: true },
      parameters: [],
      result: { type: 'Boolean', singleton: true }
    }
  ],
  evaluate
};