import type { FunctionDefinition } from '../types';
import { Errors } from '../errors';
import type { FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // Check if we have exactly 2 arguments
  if (args.length !== 2) {
    throw Errors.invalidOperation('replace requires exactly 2 arguments: pattern and substitution');
  }
  
  // If input is empty, return empty
  if (input.length === 0) {
    return { value: [], context };
  }
  
  // If input has multiple items, signal an error
  if (input.length > 1) {
    throw Errors.invalidOperation('replace can only be used on a single string value');
  }
  
  const boxedInput = input[0];
  if (!boxedInput) {
    return { value: [], context };
  }
  
  const inputValue = unbox(boxedInput);
  
  // Input must be a string
  if (typeof inputValue !== 'string') {
    return { value: [], context };
  }
  
  // Evaluate pattern argument
  const patternNode = args[0];
  if (!patternNode) {
    return { value: [], context };
  }
  const patternResult = evaluator(patternNode, input, context);
  
  // If pattern is empty collection, return empty
  if (patternResult.value.length === 0) {
    return { value: [], context };
  }
  
  // Pattern must be single string
  if (patternResult.value.length > 1) {
    throw Errors.invalidOperation('replace pattern must be a single string value');
  }
  
  const boxedPattern = patternResult.value[0];
  if (!boxedPattern) {
    return { value: [], context };
  }
  
  const pattern = unbox(boxedPattern);
  if (typeof pattern !== 'string') {
    return { value: [], context };
  }
  
  // Evaluate substitution argument
  const substitutionNode = args[1];
  if (!substitutionNode) {
    return { value: [], context };
  }
  const substitutionResult = evaluator(substitutionNode, input, context);
  
  // If substitution is empty collection, return empty
  if (substitutionResult.value.length === 0) {
    return { value: [], context };
  }
  
  // Substitution must be single string
  if (substitutionResult.value.length > 1) {
    throw Errors.invalidOperation('replace substitution must be a single string value');
  }
  
  const boxedSubstitution = substitutionResult.value[0];
  if (!boxedSubstitution) {
    return { value: [], context };
  }
  
  const substitution = unbox(boxedSubstitution);
  if (typeof substitution !== 'string') {
    return { value: [], context };
  }
  
  // Handle special case: empty pattern
  if (pattern === '') {
    // Insert substitution between every character
    const chars = inputValue.split('');
    const result = substitution + chars.join(substitution) + substitution;
    return { value: [box(result, { type: 'String', singleton: true })], context };
  }
  
  // Normal replacement: replace all occurrences
  const result = inputValue.split(pattern).join(substitution);
  
  return { value: [box(result, { type: 'Integer', singleton: true })], context };
};

export const replaceFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'replace',
  category: ['string'],
  description: 'Returns the input string with all instances of pattern replaced with substitution',
  examples: [
    "'abcdefg'.replace('cde', '123')",
    "'abcdefg'.replace('cde', '')",
    "'abc'.replace('', 'x')"
  ],
  signature: {
    input: { type: 'String', singleton: true },
    parameters: [
      { name: 'pattern', type: { type: 'String', singleton: true } },
      { name: 'substitution', type: { type: 'String', singleton: true } }
    ],
    result: { type: 'String', singleton: true },
  },
  evaluate
};