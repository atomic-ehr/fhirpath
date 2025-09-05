import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../interpreter/boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // Check single item in input
  if (input.length === 0) {
    return { value: [], context };
  }
  
  if (input.length > 1) {
    throw Errors.stringSingletonRequired('replaceMatches', input.length);
  }

  const boxedInputValue = input[0];
  if (!boxedInputValue) {
    return { value: [], context };
  }
  
  const inputValue = unbox(boxedInputValue);
  if (typeof inputValue !== 'string') {
    throw Errors.stringOperationOnNonString('replaceMatches');
  }

  // Check arguments
  if (args.length !== 2) {
    throw Errors.wrongArgumentCount('replaceMatches', 2, args.length);
  }

  // Evaluate regex argument
  const regexArg = args[0];
  if (!regexArg) {
    throw Errors.argumentRequired('replaceMatches', 'regex argument');
  }
  
  const regexResult = await evaluator(regexArg, input, context);
  
  if (regexResult.value.length === 0) {
    return { value: [], context };
  }
  
  if (regexResult.value.length > 1) {
    throw Errors.singletonRequired('replaceMatches regex', regexResult.value.length);
  }
  
  const boxedRegex = regexResult.value[0];
  if (!boxedRegex) {
    return { value: [], context };
  }
  
  const regexPattern = unbox(boxedRegex);
  if (typeof regexPattern !== 'string') {
    throw Errors.invalidStringOperation('replaceMatches', 'regex argument');
  }

  // Evaluate substitution argument
  const substitutionArg = args[1];
  if (!substitutionArg) {
    throw Errors.argumentRequired('replaceMatches', 'substitution argument');
  }
  
  const substitutionResult = await evaluator(substitutionArg, input, context);
  
  if (substitutionResult.value.length === 0) {
    return { value: [], context };
  }
  
  if (substitutionResult.value.length > 1) {
    throw Errors.singletonRequired('replaceMatches substitution', substitutionResult.value.length);
  }
  
  const boxedSubstitution = substitutionResult.value[0];
  if (!boxedSubstitution) {
    return { value: [], context };
  }
  
  const substitution = unbox(boxedSubstitution);
  if (typeof substitution !== 'string') {
    throw Errors.invalidStringOperation('replaceMatches', 'substitution argument');
  }

  // FHIRPath spec: empty pattern should return the original string unchanged
  if (regexPattern === '') {
    return { value: [box(inputValue, { type: 'String', singleton: true })], context };
  }

  try {
    // Create regex with unicode support, single line mode (dotAll), and global flag for all matches
    // Per spec: case-sensitive, single line mode, allow Unicode
    const regex = new RegExp(regexPattern, 'gus');
    
    // JavaScript's replace supports $1, $2 etc for capture groups
    // The spec also mentions named groups with ${name} syntax
    // JavaScript natively supports both $1 and $<name> syntax
    // We need to convert ${name} to $<name> for JavaScript compatibility
    const jsSubstitution = substitution.replace(/\$\{([^}]+)\}/g, '$<$1>');
    
    const result = inputValue.replace(regex, jsSubstitution);
    
    return { value: [box(result, { type: 'String', singleton: true })], context };
  } catch (error) {
    throw new Error(`Invalid regular expression in replaceMatches(): ${(error as Error).message}`);
  }
};

export const replaceMatchesFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'replaceMatches',
  category: ['string'],
  description: 'Replaces all matches of the regex pattern with the substitution string',
  examples: [
    "'test string'.replaceMatches('test', 'match')",
    "'11/30/1972'.replaceMatches('\\\\b(\\\\d{1,2})/(\\\\d{1,2})/(\\\\d{2,4})\\\\b', '$2-$1-$3')",
    "'test test'.replaceMatches('t', 'T')"
  ],
  signatures: [{
    name: 'replaceMatches',
    input: { type: 'String', singleton: true },
    parameters: [
      { name: 'regex', type: { type: 'String', singleton: true } },
      { name: 'substitution', type: { type: 'String', singleton: true } }
    ],
    result: { type: 'String', singleton: true }
  }],
  evaluate
};