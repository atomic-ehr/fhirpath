import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // toBoolean() takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('toBoolean', 0, args.length);
  }

  // If input collection is empty, result is empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input collection contains multiple items, signal an error
  if (input.length > 1) {
    throw Errors.singletonRequired('toBoolean', input.length);
  }

  const boxedInputValue = input[0];
  if (!boxedInputValue) {
    return { value: [], context };
  }
  
  const inputValue = unbox(boxedInputValue);

  // Handle different input types according to spec
  
  // Boolean - return as is (boxed)
  if (typeof inputValue === 'boolean') {
    return { value: [box(inputValue, { type: 'Boolean', singleton: true })], context };
  }
  
  // Integer - 1 -> true, 0 -> false
  if (typeof inputValue === 'number' && Number.isInteger(inputValue)) {
    if (inputValue === 1) {
      return { value: [box(true, { type: 'Boolean', singleton: true })], context };
    } else if (inputValue === 0) {
      return { value: [box(false, { type: 'Boolean', singleton: true })], context };
    }
    // Other integers return empty
    return { value: [], context };
  }
  
  // Decimal - 1.0 -> true, 0.0 -> false
  if (typeof inputValue === 'number' && !Number.isInteger(inputValue)) {
    if (inputValue === 1.0) {
      return { value: [box(true, { type: 'Boolean', singleton: true })], context };
    } else if (inputValue === 0.0) {
      return { value: [box(false, { type: 'Boolean', singleton: true })], context };
    }
    // Other decimals return empty
    return { value: [], context };
  }
  
  // String - various representations (case insensitive)
  if (typeof inputValue === 'string') {
    const lowerValue = inputValue.toLowerCase();
    
    // True representations
    if (['true', 't', 'yes', 'y', '1', '1.0'].includes(lowerValue)) {
      return { value: [box(true, { type: 'Boolean', singleton: true })], context };
    }
    
    // False representations
    if (['false', 'f', 'no', 'n', '0', '0.0'].includes(lowerValue)) {
      return { value: [box(false, { type: 'Boolean', singleton: true })], context };
    }
    
    // Other strings return empty
    return { value: [], context };
  }

  // For all other types, return empty
  return { value: [], context };
};

export const toBooleanFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'toBoolean',
  category: ['type-conversion'],
  description: 'Converts the input to a Boolean. Accepts: Boolean (identity), Integer (1->true, 0->false), Decimal (1.0->true, 0.0->false), String (\'true\'/\'t\'/\'yes\'/\'y\'/\'1\'/\'1.0\'->true, \'false\'/\'f\'/\'no\'/\'n\'/\'0\'/\'0.0\'->false, case insensitive). Returns empty for all other values. Throws error for multiple input items.',
  examples: [
    "'true'.toBoolean()",
    "'FALSE'.toBoolean()",
    "'yes'.toBoolean()",
    "'no'.toBoolean()",
    "1.toBoolean()",
    "0.toBoolean()",
    "1.0.toBoolean()",
    "0.0.toBoolean()"
  ],
  signatures: [{

    name: 'toBoolean',
    input: { type: 'Any', singleton: true },
    parameters: [],
    result: { type: 'Boolean', singleton: true }
  }],
  evaluate
};