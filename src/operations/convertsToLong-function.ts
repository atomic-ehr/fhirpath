import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../interpreter/boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // convertsToLong() takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('convertsToLong', 0, args.length);
  }

  // If input collection is empty, result is empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input collection contains multiple items, signal an error
  if (input.length > 1) {
    throw Errors.singletonRequired('convertsToLong', input.length);
  }

  const boxedInputValue = input[0];
  if (!boxedInputValue) {
    return { value: [box(false, { type: 'Boolean', singleton: true })], context };
  }
  
  const inputValue = unbox(boxedInputValue);

  // Check if the value can be converted to Long
  // Note: In JavaScript, we don't have a separate Long type, but we can check
  // if the value would be a valid long (integer within safe bounds)
  
  // Integer - always convertible to Long
  if (typeof inputValue === 'number' && Number.isInteger(inputValue)) {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }
  
  // String - check if valid integer format (same as convertsToInteger)
  if (typeof inputValue === 'string') {
    // Regex from spec: (\+|-)?\d+
    const integerRegex = /^(\+|-)?\d+$/;
    if (!integerRegex.test(inputValue)) {
      return { value: [box(false, { type: 'Boolean', singleton: true })], context };
    }
    
    // For Long, we should check if the value is within valid bounds
    // In JavaScript, we can safely represent integers up to Number.MAX_SAFE_INTEGER
    try {
      const longValue = BigInt(inputValue);
      // Check if it can be safely represented
      // For FHIRPath, Long is typically 64-bit integer
      const MAX_LONG = BigInt('9223372036854775807');
      const MIN_LONG = BigInt('-9223372036854775808');
      
      const canConvert = longValue >= MIN_LONG && longValue <= MAX_LONG;
      return { value: [box(canConvert, { type: 'Boolean', singleton: true })], context };
    } catch {
      return { value: [box(false, { type: 'Boolean', singleton: true })], context };
    }
  }
  
  // Boolean - always convertible (true -> 1, false -> 0)
  if (typeof inputValue === 'boolean') {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }

  // For all other types (including decimals), return false
  return { value: [box(false, { type: 'Boolean', singleton: true })], context };
};

export const convertsToLongFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'convertsToLong',
  category: ['type-conversion'],
  description: 'Returns true if the input can be converted to a Long (64-bit integer). Returns true for: Integer (any), String matching regex (\\+|-)?\\d+ within 64-bit bounds, Boolean (any). Returns false for all other types including decimals.',
  examples: [
    "'42'.convertsToLong()",
    "'9223372036854775807'.convertsToLong()",
    "'9223372036854775808'.convertsToLong()",
    "true.convertsToLong()"
  ],
  signatures: [
    {
      name: 'convertsToLong',
      input: { type: 'Any', singleton: true },
      parameters: [],
      result: { type: 'Boolean', singleton: true }
    }
  ],
  evaluate
};