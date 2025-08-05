import type { FunctionDefinition } from '../types';
import { Errors } from '../errors';
import type { FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // contains() requires exactly 1 argument
  if (args.length !== 1) {
    throw Errors.wrongArgumentCount('contains', 1, args.length);
  }

  const substringExpr = args[0];
  if (!substringExpr) {
    throw Errors.argumentRequired('contains', 'substring argument');
  }

  // If input collection is empty, result is empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input collection contains multiple items, signal an error
  if (input.length > 1) {
    throw Errors.invalidOperation('contains can only be applied to a single string');
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

  // Evaluate the substring expression
  const substringResult = evaluator(substringExpr, input, context);
  
  // If substring evaluation is empty, return empty
  if (substringResult.value.length === 0) {
    return { value: [], context };
  }
  
  // Substring must be a single string
  if (substringResult.value.length > 1) {
    throw Errors.invalidOperation('contains substring argument must evaluate to a single value');
  }
  
  const boxedSubstring = substringResult.value[0];
  if (!boxedSubstring) {
    return { value: [], context };
  }
  
  const substring = unbox(boxedSubstring);
  if (typeof substring !== 'string') {
    // Non-string substring returns empty
    return { value: [], context };
  }

  // If substring is empty string, result is true
  if (substring === '') {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }

  // Check if input string contains the substring
  const result = inputValue.includes(substring);
  return { value: [box(result, { type: 'Boolean', singleton: true })], context };
};

export const containsFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'contains',
  category: ['string'],
  description: 'Returns true when the given substring is a substring of the input string. If substring is the empty string, the result is true. If the input collection is empty, the result is empty. If the input collection contains multiple items, the evaluation of the expression will end and signal an error to the calling environment.',
  examples: [
    "'abc'.contains('b')",
    "'abc'.contains('bc')", 
    "'abc'.contains('d')"
  ],
  signature: {
    input: { type: 'String', singleton: true },
    parameters: [
      { name: 'substring', type: { type: 'String', singleton: true } }
    ],
    result: { type: 'Boolean', singleton: true }
  },
  evaluate
};
