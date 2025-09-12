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
    throw Errors.invalidOperation('encode can only be applied to a singleton string');
  }
  
  const boxedInputValue = input[0];
  if (!boxedInputValue) {
    return { value: [], context };
  }
  
  const inputValue = unbox(boxedInputValue);
  
  // Type check the input - must be a string
  if (typeof inputValue !== 'string') {
    throw Errors.stringOperationOnNonString('encode');
  }
  
  // encode() requires exactly one argument (format)
  if (!args || args.length !== 1) {
    throw Errors.invalidOperation('encode requires exactly one argument (format)');
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
    throw Errors.invalidOperation('encode format must be a singleton string');
  }
  
  const boxedFormat = formatResult.value[0];
  if (!boxedFormat) {
    return { value: [], context };
  }
  
  const format = unbox(boxedFormat);
  if (typeof format !== 'string') {
    throw Errors.invalidOperation('encode format must be a string');
  }
  
  let result: string;
  
  switch (format.toLowerCase()) {
    case 'hex': {
      // Encode to hexadecimal (lowercase)
      const bytes = Buffer.from(inputValue, 'utf-8');
      result = bytes.toString('hex');
      break;
    }
    case 'base64': {
      // Standard base64 encoding
      const bytes = Buffer.from(inputValue, 'utf-8');
      result = bytes.toString('base64');
      break;
    }
    case 'urlbase64': {
      // URL-safe base64 encoding (using - and _ instead of + and /)
      const bytes = Buffer.from(inputValue, 'utf-8');
      result = bytes.toString('base64url');
      // base64url doesn't use padding, but FHIRPath spec says output should be padded with =
      // Add padding if necessary
      const paddingLength = (4 - (result.length % 4)) % 4;
      result = result + '='.repeat(paddingLength);
      break;
    }
    default:
      // Unknown format, return empty
      return { value: [], context };
  }
  
  return { value: [box(result, { type: 'String', singleton: true })], context };
};

export const encodeFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'encode',
  category: ['string'],
  description: 'Returns the result of encoding the input string in the given format. Available formats are hex, base64, and urlbase64.',
  examples: [
    "'test'.encode('base64') // returns 'dGVzdA=='",
    "'test'.encode('hex') // returns '74657374'",
    "'subjects?_d'.encode('urlbase64') // returns 'c3ViamVjdHM_X2Q='"
  ],
  signatures: [{
    name: 'encode',
    input: { type: 'String', singleton: true },
    parameters: [
      { name: 'format', type: { type: 'String', singleton: true } }
    ],
    result: { type: 'String', singleton: true }
  }],
  evaluate
};