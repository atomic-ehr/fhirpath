import type { FunctionDefinition } from '../types';
import { Errors } from '../errors';
import { type FunctionEvaluator } from '../types';
import { unbox, box } from '../interpreter/boxing';

// 64-bit Long bounds
const MAX_LONG = BigInt('9223372036854775807');
const MIN_LONG = BigInt('-9223372036854775808');

// Regex for integer string format
const INTEGER_REGEX = /^[+-]?\d+$/;

export const evaluate: FunctionEvaluator = async (input, context, args) => {
  // toLong takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('toLong', 0, args.length);
  }

  // Check singleton requirement
  if (input.length > 1) {
    throw Errors.singletonRequired('toLong', input.length);
  }

  if (input.length === 0) {
    return { value: [], context };
  }

  const item = input[0];
  if (!item) {
    return { value: [], context };
  }
  
  const unboxedItem = unbox(item);
  const itemType = (item as any).typeInfo?.type || (item as any).type;
  
  let resultValue: number | null = null;

  // Handle different input types
  if (itemType === 'Integer' || itemType === 'Long') {
    // Integer/Long passthrough
    resultValue = unboxedItem as number;
  } else if (itemType === 'Boolean') {
    // true → 1, false → 0
    resultValue = unboxedItem ? 1 : 0;
  } else if (itemType === 'String') {
    // Try to parse the string as an integer
    const str = unboxedItem as string;
    
    // Check if string matches integer format
    if (!INTEGER_REGEX.test(str)) {
      return { value: [], context };
    }
    
    try {
      // Use BigInt to parse and check bounds
      const bigIntValue = BigInt(str);
      
      // Check 64-bit bounds
      if (bigIntValue < MIN_LONG || bigIntValue > MAX_LONG) {
        return { value: [], context };
      }
      
      // Convert back to number (safe within 64-bit bounds)
      resultValue = Number(bigIntValue);
    } catch (e) {
      // Parse failed
      return { value: [], context };
    }
  } else {
    // Other types return empty
    return { value: [], context };
  }

  // Box the result as Long type
  return { 
    value: [box(resultValue, { type: 'Long', singleton: true })], 
    context 
  };
};

export const toLongFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'toLong',
  category: ['conversion'],
  description: 'Converts the input to a 64-bit Long integer. Integers are passed through, Strings are parsed if they match integer format and are within 64-bit bounds, Boolean true becomes 1 and false becomes 0. This is a Standard for Trial Use (STU) feature.',
  examples: [
    '1.toLong() // Returns 1',
    '\'123\'.toLong() // Returns 123',
    'true.toLong() // Returns 1',
    '\'9223372036854775807\'.toLong() // Max 64-bit value'
  ],
  signatures: [{
    name: 'toLong',
    input: { type: 'Any', singleton: true },
    parameters: [],
    result: { type: 'Long', singleton: true }
  }],
  evaluate
};