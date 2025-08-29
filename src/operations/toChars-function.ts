import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // Check single item in input
  if (input.length === 0) {
    return { value: [], context };
  }
  
  if (input.length > 1) {
    throw Errors.stringSingletonRequired('toChars', input.length);
  }

  const boxedInputValue = input[0];
  if (!boxedInputValue) {
    return { value: [], context };
  }
  
  const inputValue = unbox(boxedInputValue);
  if (typeof inputValue !== 'string') {
    throw Errors.stringOperationOnNonString('toChars');
  }

  // Check arguments - toChars takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('toChars', 0, args.length);
  }

  // Convert string to array of single-character strings
  // Use Array.from to properly handle Unicode characters (including emoji)
  const chars = Array.from(inputValue);
  
  // Box each character as a String
  const result = chars.map(char => box(char, { type: 'String', singleton: true }));
  
  return { value: result, context };
};

export const toCharsFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'toChars',
  category: ['string'],
  description: 'Returns the list of characters in the input string as a collection',
  examples: [
    "'abc'.toChars()",
    "'Hello'.toChars()",
    "''.toChars()"
  ],
  signatures: [{
    name: 'toChars',
    input: { type: 'String', singleton: true },
    parameters: [],
    result: { type: 'String', singleton: false }
  }],
  evaluate
};