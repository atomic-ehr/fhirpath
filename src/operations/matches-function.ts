import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // Check single item in input
  if (input.length === 0) {
    return { value: [], context };
  }
  
  if (input.length > 1) {
    throw Errors.stringSingletonRequired('matches', input.length);
  }

  const boxedInputValue = input[0];
  if (!boxedInputValue) {
    return { value: [], context };
  }
  
  const inputValue = unbox(boxedInputValue);
  if (typeof inputValue !== 'string') {
    throw Errors.stringOperationOnNonString('matches');
  }

  // Check arguments
  if (args.length !== 1) {
    throw Errors.wrongArgumentCount('matches', 1, args.length);
  }

  // Evaluate regex argument
  const regexArg = args[0];
  if (!regexArg) {
    throw Errors.argumentRequired('matches', 'regex argument');
  }
  
  const regexResult = await evaluator(regexArg, input, context);
  
  if (regexResult.value.length === 0) {
    return { value: [], context };
  }
  
  if (regexResult.value.length > 1) {
    throw Errors.singletonRequired('matches regex', regexResult.value.length);
  }
  
  const boxedRegex = regexResult.value[0];
  if (!boxedRegex) {
    return { value: [], context };
  }
  
  const regexPattern = unbox(boxedRegex);
  if (typeof regexPattern !== 'string') {
    throw Errors.invalidStringOperation('matches', 'regex argument');
  }

  try {
    // Create regex with unicode support and single line mode (dotAll)
    // Per spec: case-sensitive, single line mode, allow Unicode
    const regex = new RegExp(regexPattern, 'us');
    const result = regex.test(inputValue);
    
    return { value: [box(result, { type: 'Boolean', singleton: true })], context };
  } catch (error) {
    throw new Error(`Invalid regular expression in matches(): ${(error as Error).message}`);
  }
};

export const matchesFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'matches',
  category: ['string'],
  description: 'Returns true when the input string matches the given regular expression',
  examples: [
    "'test string'.matches('t.+')",
    "'test string'.matches('asd.+')",
    "'first line\\nsecond line'.matches('line.second')"
  ],
  signatures: [{
    name: 'matches',
    input: { type: 'String', singleton: true },
    parameters: [
      { name: 'regex', type: { type: 'String', singleton: true } }
    ],
    result: { type: 'Boolean', singleton: true }
  }],
  evaluate
};