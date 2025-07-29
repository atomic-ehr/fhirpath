import type { FunctionDefinition, FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // Handle empty input collection
  if (input.length === 0) {
    return { value: [], context };
  }
  
  // If input contains multiple items, signal an error
  if (input.length > 1) {
    throw new Error('toDecimal() can only be applied to a singleton');
  }
  
  // toDecimal() takes no arguments
  if (args && args.length > 0) {
    throw new Error('toDecimal() does not take any arguments');
  }
  
  const inputValue = input[0];
  
  // Handle different input types according to spec
  
  // Integer or Decimal - return as decimal
  if (typeof inputValue === 'number') {
    return { value: [inputValue], context };
  }
  
  // Boolean - true -> 1.0, false -> 0.0
  if (typeof inputValue === 'boolean') {
    return { value: [inputValue ? 1.0 : 0.0], context };
  }
  
  // String - try to convert to decimal
  if (typeof inputValue === 'string') {
    // Use the regex from the spec: (\+|-)?\d+(\.\d+)?
    const decimalRegex = /^(\+|-)?\d+(\.\d+)?$/;
    
    if (!decimalRegex.test(inputValue)) {
      // String is not convertible to decimal
      return { value: [], context };
    }
    
    const parsedValue = parseFloat(inputValue);
    
    // Check for valid number
    if (isNaN(parsedValue)) {
      return { value: [], context };
    }
    
    return { value: [parsedValue], context };
  }
  
  // For any other type, return empty
  return { value: [], context };
};

export const toDecimalFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'toDecimal',
  category: ['type-conversion'],
  description: 'Converts the input to a Decimal value. Returns a single decimal for Integer, Decimal, convertible String, or Boolean inputs. Returns empty for non-convertible values.',
  examples: [
    "'3.14'.toDecimal() // returns 3.14",
    "42.toDecimal() // returns 42.0",
    "true.toDecimal() // returns 1.0",
    "false.toDecimal() // returns 0.0"
  ],
  signature: {
    input: { type: 'Any', singleton: true },
    parameters: [],
    result: { type: 'Decimal', singleton: true }
  },
  evaluate
};