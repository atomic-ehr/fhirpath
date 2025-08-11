import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // Handle empty input collection
  if (input.length === 0) {
    return { value: [], context };
  }
  
  // If input contains multiple items, signal an error
  if (input.length > 1) {
    throw Errors.invalidOperation('upper can only be applied to a singleton string');
  }
  
  const boxedInputValue = input[0];
  if (!boxedInputValue) {
    return { value: [], context };
  }
  
  const inputValue = unbox(boxedInputValue);
  
  // Type check the input - must be a string
  if (typeof inputValue !== 'string') {
    throw Errors.stringOperationOnNonString('upper');
  }
  
  // upper() takes no arguments
  if (args && args.length > 0) {
    throw Errors.invalidOperation('upper does not take any arguments');
  }
  
  // Convert to uppercase
  const result = inputValue.toUpperCase();
  
  return { value: [box(result, { type: 'String', singleton: true })], context };
};

export const upperFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'upper',
  category: ['string'],
  description: 'Returns the input string with all characters converted to upper case. If the input collection is empty, the result is empty. If the input collection contains multiple items, the evaluation of the expression will end and signal an error to the calling environment.',
  examples: [
    "'abcdefg'.upper() // returns 'ABCDEFG'",
    "'AbCdefg'.upper() // returns 'ABCDEFG'"
  ],
  signatures: [{

    name: 'upper',
    input: { type: 'String', singleton: true },
    parameters: [],
    result: { type: 'String', singleton: true }
  }],
  evaluate
};