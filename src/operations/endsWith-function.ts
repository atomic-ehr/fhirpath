import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // Validate arguments
  if (args.length !== 1) {
    throw Errors.wrongArgumentCount('endsWith', 1, args.length);
  }

  // If input is empty, return empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input has multiple items, signal an error
  if (input.length > 1) {
    throw Errors.singletonRequired('endsWith', input.length);
  }

  const boxedInputValue = input[0];
  if (!boxedInputValue) {
    return { value: [], context };
  }
  
  const inputValue = unbox(boxedInputValue);

  // Check that input is a string
  if (typeof inputValue !== 'string') {
    throw Errors.stringOperationOnNonString('endsWith');
  }

  // Evaluate the suffix argument
  if (!args[0]) {
    throw Errors.argumentRequired('endsWith', 'suffix argument');
  }
  const suffixResult = evaluator(args[0], input, context);
  
  // Validate that suffix is a singleton string
  if (suffixResult.value.length !== 1) {
    throw Errors.invalidOperation('endsWith suffix argument must be a single value');
  }
  
  const boxedSuffix = suffixResult.value[0];
  if (!boxedSuffix) {
    return { value: [], context };
  }
  
  const suffix = unbox(boxedSuffix);
  
  // Check that suffix is a string
  if (typeof suffix !== 'string') {
    throw Errors.invalidStringOperation('endsWith', 'suffix argument');
  }
  
  // If suffix is empty string, result is true
  if (suffix === '') {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }
  
  // Check if input ends with suffix
  const result = inputValue.endsWith(suffix);
  
  return { value: [box(result, { type: 'Boolean', singleton: true })], context };
};

export const endsWithFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'endsWith',
  category: ['string'],
  description: 'Returns true when the input string ends with the given suffix. If suffix is the empty string, the result is true. If the input collection is empty, the result is empty. If the input collection contains multiple items, an error is signaled.',
  examples: [
    "'abcdefg'.endsWith('efg')",
    "'abcdefg'.endsWith('abc')"
  ],
  signature: {
    input: { type: 'String', singleton: true },
    parameters: [
      { name: 'suffix', type: { type: 'String', singleton: true } }
    ],
    result: { type: 'Boolean', singleton: true }
  },
  evaluate
};