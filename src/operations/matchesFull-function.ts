import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../interpreter/boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // Check single item in input
  if (input.length === 0) {
    return { value: [], context };
  }
  
  if (input.length > 1) {
    throw Errors.stringSingletonRequired('matchesFull', input.length);
  }

  const boxedInputValue = input[0];
  if (!boxedInputValue) {
    return { value: [], context };
  }
  
  const inputValue = unbox(boxedInputValue);
  if (typeof inputValue !== 'string') {
    throw Errors.stringOperationOnNonString('matchesFull');
  }

  // Check arguments
  if (args.length !== 1) {
    throw Errors.wrongArgumentCount('matchesFull', 1, args.length);
  }

  // Evaluate regex argument
  const regexArg = args[0];
  if (!regexArg) {
    throw Errors.argumentRequired('matchesFull', 'regex argument');
  }
  
  const regexResult = await evaluator(regexArg, input, context);
  
  if (regexResult.value.length === 0) {
    return { value: [], context };
  }
  
  if (regexResult.value.length > 1) {
    throw Errors.singletonRequired('matchesFull regex', regexResult.value.length);
  }
  
  const boxedRegex = regexResult.value[0];
  if (!boxedRegex) {
    return { value: [], context };
  }
  
  const regexPattern = unbox(boxedRegex);
  if (typeof regexPattern !== 'string') {
    throw Errors.invalidStringOperation('matchesFull', 'regex argument');
  }

  try {
    // matchesFull implicitly adds ^ and $ anchors to match the entire string
    // Only add anchors if they're not already present
    let fullPattern = regexPattern;
    if (!regexPattern.startsWith('^')) {
      fullPattern = '^' + fullPattern;
    }
    if (!regexPattern.endsWith('$')) {
      fullPattern = fullPattern + '$';
    }
    
    // Create regex with unicode support and single line mode (dotAll)
    // Per spec: case-sensitive, single line mode, allow Unicode
    const regex = new RegExp(fullPattern, 'us');
    const result = regex.test(inputValue);
    
    return { value: [box(result, { type: 'Boolean', singleton: true })], context };
  } catch (error) {
    throw new Error(`Invalid regular expression in matchesFull(): ${(error as Error).message}`);
  }
};

export const matchesFullFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'matchesFull',
  category: ['string'],
  description: 'Returns true when the input string completely matches the given regular expression',
  examples: [
    "'Library'.matchesFull('Library')",
    "'http://example.org/Library'.matchesFull('Library')",
    "'N8000123'.matchesFull('N[0-9]{7}')"
  ],
  signatures: [{
    name: 'matchesFull',
    input: { type: 'String', singleton: true },
    parameters: [
      { name: 'regex', type: { type: 'String', singleton: true } }
    ],
    result: { type: 'Boolean', singleton: true }
  }],
  evaluate
};