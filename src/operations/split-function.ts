import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // Handle empty input collection
  if (input.length === 0) {
    return { value: [], context };
  }

  // Validate singleton input
  if (input.length !== 1) {
    throw Errors.invalidOperation('split requires a singleton input');
  }

  const boxedInputValue = input[0];
  if (!boxedInputValue) {
    return { value: [], context };
  }
  
  const inputValue = unbox(boxedInputValue);
  
  // Type check the input - must be a string
  if (typeof inputValue !== 'string') {
    throw Errors.stringOperationOnNonString('split');
  }

  // Validate arguments - requires exactly one argument
  if (!args || args.length !== 1) {
    throw Errors.invalidOperation('split requires exactly one argument');
  }

  // Evaluate the separator argument
  const separatorArg = args[0];
  if (!separatorArg) {
    throw Errors.invalidOperation('split requires exactly one argument');
  }
  const separatorResult = evaluator(separatorArg, input, context);
  
  if (separatorResult.value.length !== 1) {
    throw Errors.invalidOperation('split separator must be a singleton');
  }
  
  const boxedSeparator = separatorResult.value[0];
  if (!boxedSeparator) {
    throw Errors.invalidOperation('split separator must be a string');
  }
  
  const separator = unbox(boxedSeparator);
  
  if (typeof separator !== 'string') {
    throw Errors.invalidOperation('split separator must be a string');
  }

  // Perform the split operation
  const result = inputValue.split(separator);
  
  // Box each result string
  const boxedResult = result.map(str => box(str, { type: 'String', singleton: false }));

  return { value: boxedResult, context };
};

export const splitFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'split',
  category: ['string'],
  description: 'Splits a singleton input string into a list of strings, using the given separator. If the input is empty, the result is empty. If the input string does not contain any appearances of the separator, the result is the input string.',
  examples: [
    "('A,B,C').split(',') // returns { 'A', 'B', 'C' }",
    "('ABC').split(',') // returns { 'ABC' }",
    "'A,,C'.split(',') // returns { 'A', '', 'C' }"
  ],
  signatures: [{

    name: 'split',
    input: { type: 'String', singleton: true },
    parameters: [
      { name: 'separator', type: { type: 'String', singleton: true } }
    ],
    result: { type: 'String', singleton: false }
  }],
  evaluate
};