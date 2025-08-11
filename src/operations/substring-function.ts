import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // Check single item in input
  if (input.length === 0) {
    return { value: [], context };
  }
  
  if (input.length > 1) {
    throw Errors.stringSingletonRequired('substring', input.length);
  }

  const boxedInput = input[0];
  if (!boxedInput) {
    return { value: [], context };
  }
  
  const inputValue = unbox(boxedInput);
  if (typeof inputValue !== 'string') {
    throw Errors.stringOperationOnNonString('substring');
  }

  // Check arguments - requires at least 1 (start), optionally 2 (start, length)
  if (args.length === 0 || args.length > 2) {
    throw Errors.invalidOperation('substring requires 1 or 2 arguments (start, and optionally length)');
  }

  // Evaluate start argument
  const startArg = args[0];
  if (!startArg) {
    return { value: [], context };
  }
  
  const startResult = evaluator(startArg, input, context);
  
  if (startResult.value.length === 0) {
    return { value: [], context };
  }
  
  if (startResult.value.length > 1) {
    throw Errors.singletonRequired('substring start', startResult.value.length);
  }
  
  const boxedStart = startResult.value[0];
  if (!boxedStart) {
    return { value: [], context };
  }
  
  const start = unbox(boxedStart);
  if (typeof start !== 'number' || !Number.isInteger(start)) {
    throw Errors.invalidNumericOperation('substring', 'start argument', 'integer');
  }

  // If start is outside string bounds, return empty
  if (start < 0 || start > inputValue.length) {
    return { value: [], context };
  }
  
  // Special case: start equals string length (e.g., empty string with start 0)
  if (start === inputValue.length) {
    return { value: [box('', { type: 'String', singleton: true })], context };
  }

  // Handle optional length argument
  let length: number | undefined;
  
  if (args.length === 2) {
    const lengthArg = args[1];
    if (lengthArg) {
      const lengthResult = evaluator(lengthArg, input, context);
      
      if (lengthResult.value.length === 0) {
        // Empty length - behave as if length not provided
        length = undefined;
      } else {
        if (lengthResult.value.length > 1) {
          throw Errors.singletonRequired('substring length', lengthResult.value.length);
        }
        
        const boxedLength = lengthResult.value[0];
        if (!boxedLength) {
          length = undefined;
        } else {
          const lengthValue = unbox(boxedLength);
          if (typeof lengthValue !== 'number' || !Number.isInteger(lengthValue)) {
            throw Errors.invalidNumericOperation('substring', 'length argument', 'integer');
          }
        
          // Negative or zero length returns empty string
          if (lengthValue <= 0) {
            return { value: [box('', { type: 'String', singleton: true })], context };
          }
          
          length = lengthValue;
        }
      }
    }
  }

  // Extract substring
  let result: string;
  if (length === undefined) {
    // No length specified - return from start to end
    result = inputValue.substring(start);
  } else {
    // Length specified - return at most length characters
    result = inputValue.substring(start, start + length);
  }
  
  return { value: [box(result, { type: 'String', singleton: true })], context };
};

export const substringFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'substring',
  category: ['string'],
  description: 'Returns the part of the string starting at position start (zero-based). If length is given, will return at most length number of characters from the input string',
  examples: [
    "'abcdefg'.substring(3)",
    "'abcdefg'.substring(1, 2)",
    "'abcdefg'.substring(6, 2)"
  ],
  signatures: [{

    name: 'substring',
    input: { type: 'String', singleton: true },
    parameters: [
      { name: 'start', type: { type: 'Integer', singleton: true } },
      { name: 'length', type: { type: 'Integer', singleton: true }, optional: true }
    ],
    result: { type: 'String', singleton: true }
  }],
  evaluate
};