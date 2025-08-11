import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // startsWith() requires exactly 1 argument
  if (args.length !== 1) {
    throw Errors.wrongArgumentCount('startsWith', 1, args.length);
  }

  const prefixExpr = args[0];
  if (!prefixExpr) {
    throw Errors.argumentRequired('startsWith', 'prefix argument');
  }

  // If input collection is empty, result is empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input collection contains multiple items, signal an error
  if (input.length > 1) {
    throw Errors.invalidOperation('startsWith can only be applied to a single string');
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

  // Evaluate the prefix expression
  const prefixResult = await evaluator(prefixExpr, input, context);
  
  // If prefix evaluation is empty, return empty
  if (prefixResult.value.length === 0) {
    return { value: [], context };
  }
  
  // Prefix must be a single string
  if (prefixResult.value.length > 1) {
    throw Errors.invalidOperation('startsWith prefix argument must evaluate to a single value');
  }
  
  const boxedPrefix = prefixResult.value[0];
  if (!boxedPrefix) {
    return { value: [], context };
  }
  
  const prefix = unbox(boxedPrefix);
  if (typeof prefix !== 'string') {
    // Non-string prefix returns empty
    return { value: [], context };
  }

  // If prefix is empty string, result is true
  if (prefix === '') {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }

  // Check if input string starts with the prefix
  const result = inputValue.startsWith(prefix);
  return { value: [box(result, { type: 'Boolean', singleton: true })], context };
};

export const startsWithFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'startsWith',
  category: ['string'],
  description: 'Returns true when the input string starts with the given prefix. If prefix is the empty string, the result is true. If the input collection is empty, the result is empty. If the input collection contains multiple items, the evaluation of the expression will end and signal an error to the calling environment.',
  examples: [
    "'abcdefg'.startsWith('abc')",
    "'abcdefg'.startsWith('xyz')"
  ],
  signatures: [{

    name: 'startsWith',
    input: { type: 'String', singleton: true },
    parameters: [
      { name: 'prefix', type: { type: 'String', singleton: true } }
    ],
    result: { type: 'Boolean', singleton: true }
  }],
  evaluate
};