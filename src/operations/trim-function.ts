import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // trim() takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('trim', 0, args.length);
  }

  // If input collection is empty, result is empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input collection contains multiple items, signal an error
  if (input.length > 1) {
    throw Errors.invalidOperation('trim can only be applied to a single string');
  }

  // Input must be a string
  const boxedInputValue = input[0];
  if (!boxedInputValue) {
    return { value: [], context };
  }
  
  const inputValue = unbox(boxedInputValue);
  if (typeof inputValue !== 'string') {
    // Non-string input returns empty
    return { value: [], context };
  }

  // Trim whitespace from beginning and end
  // FHIRPath defines whitespace as: tab (\t), space ( ), line feed (\n), carriage return (\r)
  const trimmed = inputValue.trim();
  
  return { value: [box(trimmed, { type: 'String', singleton: true })], context };
};

export const trimFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'trim',
  category: ['string'],
  description: 'Trims whitespace characters from the beginning and ending of the input string. Whitespace includes tab (\\t), space ( ), line feed (\\n) and carriage return (\\r). If the input is empty, the result is empty.',
  examples: [
    "'  hello  '.trim()",
    "'\\thello\\n'.trim()",
    "'no-trim'.trim()"
  ],
  signatures: [{

    name: 'trim',
    input: { type: 'String', singleton: true },
    parameters: [],
    result: { type: 'String', singleton: true }
  }],
  evaluate
};