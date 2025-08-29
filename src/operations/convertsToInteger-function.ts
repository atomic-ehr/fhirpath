import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // convertsToInteger() takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('convertsToInteger', 0, args.length);
  }

  // If input collection is empty, result is empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input collection contains multiple items, signal an error
  if (input.length > 1) {
    throw Errors.singletonRequired('convertsToInteger', input.length);
  }

  const boxedInputValue = input[0];
  if (!boxedInputValue) {
    return { value: [box(false, { type: 'Boolean', singleton: true })], context };
  }
  
  const inputValue = unbox(boxedInputValue);

  // Check if the value can be converted to Integer
  
  // Integer - always convertible
  if (typeof inputValue === 'number' && Number.isInteger(inputValue)) {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }
  
  // String - check if valid integer format
  if (typeof inputValue === 'string') {
    // Regex from spec: (\+|-)?\d+
    const integerRegex = /^(\+|-)?\d+$/;
    const canConvert = integerRegex.test(inputValue);
    return { value: [box(canConvert, { type: 'Boolean', singleton: true })], context };
  }
  
  // Boolean - always convertible (true -> 1, false -> 0)
  if (typeof inputValue === 'boolean') {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }

  // For all other types (including decimals), return false
  return { value: [box(false, { type: 'Boolean', singleton: true })], context };
};

export const convertsToIntegerFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'convertsToInteger',
  category: ['type-conversion'],
  description: 'Returns true if the input can be converted to an Integer. Returns true for: Integer (any), String matching regex (\\+|-)?\\d+, Boolean (any). Returns false for all other types including decimals.',
  examples: [
    "'42'.convertsToInteger()",
    "'3.14'.convertsToInteger()",
    "true.convertsToInteger()",
    "3.14.convertsToInteger()"
  ],
  signatures: [
    {
      name: 'convertsToInteger',
      input: { type: 'Any', singleton: true },
      parameters: [],
      result: { type: 'Boolean', singleton: true }
    }
  ],
  evaluate
};