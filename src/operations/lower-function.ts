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
    throw Errors.invalidOperation('lower can only be applied to a singleton string');
  }
  
  const boxedInputValue = input[0];
  if (!boxedInputValue) {
    return { value: [], context };
  }
  
  const inputValue = unbox(boxedInputValue);
  
  // Type check the input - must be a string
  if (typeof inputValue !== 'string') {
    throw Errors.stringOperationOnNonString('lower');
  }
  
  // lower() takes no arguments
  if (args && args.length > 0) {
    throw Errors.invalidOperation('lower does not take any arguments');
  }
  
  // Convert to lowercase
  const result = inputValue.toLowerCase();
  
  return { value: [box(result, { type: 'String', singleton: true })], context };
};

export const lowerFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'lower',
  category: ['string'],
  description: 'Returns the input string with all characters converted to lower case. If the input collection is empty, the result is empty. If the input collection contains multiple items, the evaluation of the expression will end and signal an error to the calling environment.',
  examples: [
    "'ABCDEFG'.lower() // returns 'abcdefg'",
    "'aBcDEFG'.lower() // returns 'abcdefg'"
  ],
  signatures: [{

    name: 'lower',
    input: { type: 'String', singleton: true },
    parameters: [],
    result: { type: 'String', singleton: true }
  }],
  evaluate
};