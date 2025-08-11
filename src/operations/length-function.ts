import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // Check single item in input
  if (input.length === 0) {
    return { value: [], context };
  }
  
  if (input.length > 1) {
    throw Errors.stringSingletonRequired('length', input.length);
  }

  const boxedInputValue = input[0];
  if (!boxedInputValue) {
    return { value: [], context };
  }
  
  const inputValue = unbox(boxedInputValue);
  if (typeof inputValue !== 'string') {
    throw Errors.stringOperationOnNonString('length');
  }

  // length() takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('length', 0, args.length);
  }

  // Return the length of the string
  return { value: [box(inputValue.length, { type: 'Integer', singleton: true })], context };
};

export const lengthFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'length',
  category: ['string'],
  description: 'Returns the length of the input string. If the input collection is empty, the result is empty.',
  examples: [
    "'abcdefg'.length()",
    "''.length()",
    "name.given.first().length()"
  ],
  signatures: [{

    name: 'length',
    input: { type: 'String', singleton: true },
    parameters: [],
    result: { type: 'Integer', singleton: true }
  }],
  evaluate
};