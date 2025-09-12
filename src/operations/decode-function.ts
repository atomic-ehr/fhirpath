import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../interpreter/boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // Handle empty input collection
  if (input.length === 0) {
    return { value: [], context };
  }
  
  // If input contains multiple items, signal an error
  if (input.length > 1) {
    throw Errors.invalidOperation('decode can only be applied to a singleton string');
  }
  
  const boxedInputValue = input[0];
  if (!boxedInputValue) {
    return { value: [], context };
  }
  
  const inputValue = unbox(boxedInputValue);
  
  // Type check the input - must be a string
  if (typeof inputValue !== 'string') {
    throw Errors.stringOperationOnNonString('decode');
  }
  
  // decode() requires exactly one argument (format)
  if (!args || args.length !== 1) {
    throw Errors.invalidOperation('decode requires exactly one argument (format)');
  }
  
  // Evaluate the format parameter
  const formatArg = args[0];
  if (!formatArg) {
    return { value: [], context };
  }
  
  const formatResult = await evaluator(formatArg, input, context);
  if (formatResult.value.length === 0) {
    // If no format is specified, the result is empty
    return { value: [], context };
  }
  
  if (formatResult.value.length > 1) {
    throw Errors.invalidOperation('decode format must be a singleton string');
  }
  
  const boxedFormat = formatResult.value[0];
  if (!boxedFormat) {
    return { value: [], context };
  }
  
  const format = unbox(boxedFormat);
  if (typeof format !== 'string') {
    throw Errors.invalidOperation('decode format must be a string');
  }
  
  let result: string;
  
  try {
    switch (format.toLowerCase()) {
      case 'hex': {
        // Decode from hexadecimal
        const bytes = Buffer.from(inputValue, 'hex');
        result = bytes.toString('utf-8');
        break;
      }
      case 'base64': {
        // Standard base64 decoding
        const bytes = Buffer.from(inputValue, 'base64');
        result = bytes.toString('utf-8');
        break;
      }
      case 'urlbase64': {
        // URL-safe base64 decoding
        // First, convert urlbase64 to standard base64 format if needed
        // Replace URL-safe characters with standard base64 characters
        const standardBase64 = inputValue.replace(/-/g, '+').replace(/_/g, '/');
        const bytes = Buffer.from(standardBase64, 'base64');
        result = bytes.toString('utf-8');
        break;
      }
      default:
        // Unknown format, return empty
        return { value: [], context };
    }
  } catch (error) {
    // If decoding fails (invalid encoding), throw an error
    throw Errors.invalidOperation(`Failed to decode string with format '${format}': invalid encoding`);
  }
  
  return { value: [box(result, { type: 'String', singleton: true })], context };
};

export const decodeFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'decode',
  category: ['string'],
  description: 'Returns the result of decoding the input string according to the given format. Available formats are hex, base64, and urlbase64.',
  examples: [
    "'dGVzdA=='.decode('base64') // returns 'test'",
    "'74657374'.decode('hex') // returns 'test'",
    "'c3ViamVjdHM_X2Q='.decode('urlbase64') // returns 'subjects?_d'"
  ],
  signatures: [{
    name: 'decode',
    input: { type: 'String', singleton: true },
    parameters: [
      { name: 'format', type: { type: 'String', singleton: true } }
    ],
    result: { type: 'String', singleton: true }
  }],
  evaluate
};