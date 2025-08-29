import type { FunctionDefinition, FunctionEvaluator, LiteralNode } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../interpreter/boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // Check single item in input
  if (input.length === 0) {
    return { value: [], context };
  }
  
  if (input.length > 1) {
    throw Errors.stringSingletonRequired('lastIndexOf', input.length);
  }

  const boxedInputValue = input[0];
  if (!boxedInputValue) {
    return { value: [], context };
  }
  
  const inputValue = unbox(boxedInputValue);
  if (typeof inputValue !== 'string') {
    throw Errors.stringOperationOnNonString('lastIndexOf');
  }

  // Check arguments
  if (args.length !== 1) {
    throw Errors.wrongArgumentCount('lastIndexOf', 1, args.length);
  }

  // Evaluate substring argument
  const substringArg = args[0];
  if (!substringArg) {
    throw Errors.argumentRequired('lastIndexOf', 'substring argument');
  }
  
  const substringResult = await evaluator(substringArg, input, context);
  
  if (substringResult.value.length === 0) {
    return { value: [], context };
  }
  
  if (substringResult.value.length > 1) {
    throw Errors.singletonRequired('lastIndexOf substring', substringResult.value.length);
  }
  
  const boxedSubstring = substringResult.value[0];
  if (!boxedSubstring) {
    return { value: [], context };
  }
  
  const substring = unbox(boxedSubstring);
  if (typeof substring !== 'string') {
    throw Errors.invalidStringOperation('lastIndexOf', 'substring argument');
  }

  // Handle empty substring - returns 0 per spec
  if (substring === '') {
    return { value: [box(0, { type: 'Integer', singleton: true })], context };
  }

  // Find the last index
  const index = inputValue.lastIndexOf(substring);
  
  return { value: [box(index, { type: 'Integer', singleton: true })], context };
};

export const lastIndexOfFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'lastIndexOf',
  category: ['string'],
  description: 'Returns the 0-based index of the last position substring is found in the input string, or -1 if it is not found',
  examples: [
    "'abcdefg'.lastIndexOf('bc')",
    "'abcdefg'.lastIndexOf('x')",
    "'abc abc'.lastIndexOf('a')"
  ],
  signatures: [{
    name: 'lastIndexOf',
    input: { type: 'String', singleton: true },
    parameters: [
      { name: 'substring', type: { type: 'String', singleton: true } }
    ],
    result: { type: 'Integer', singleton: true }
  }],
  evaluate
};