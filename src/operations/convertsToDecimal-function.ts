import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../interpreter/boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // convertsToDecimal() takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('convertsToDecimal', 0, args.length);
  }

  // If input collection is empty, result is empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input collection contains multiple items, signal an error
  if (input.length > 1) {
    throw Errors.singletonRequired('convertsToDecimal', input.length);
  }

  const boxedInputValue = input[0];
  if (!boxedInputValue) {
    return { value: [box(false, { type: 'Boolean', singleton: true })], context };
  }
  
  const inputValue = unbox(boxedInputValue);

  // Check if the value can be converted to Decimal
  
  // Integer or Decimal - always convertible
  if (typeof inputValue === 'number') {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }
  
  // Boolean - always convertible (true -> 1.0, false -> 0.0)
  if (typeof inputValue === 'boolean') {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }
  
  // String - check if valid decimal format
  if (typeof inputValue === 'string') {
    // Use the regex from the spec: (\+|-)?\d+(\.\d+)?
    const decimalRegex = /^(\+|-)?\d+(\.\d+)?$/;
    
    if (!decimalRegex.test(inputValue)) {
      return { value: [box(false, { type: 'Boolean', singleton: true })], context };
    }
    
    const parsedValue = parseFloat(inputValue);
    
    // Check for valid number
    if (isNaN(parsedValue)) {
      return { value: [box(false, { type: 'Boolean', singleton: true })], context };
    }
    
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }

  // For all other types, return false
  return { value: [box(false, { type: 'Boolean', singleton: true })], context };
};

export const convertsToDecimalFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'convertsToDecimal',
  category: ['type-conversion'],
  description: 'Returns true if the input can be converted to a Decimal. Returns true for: Integer (any), Decimal (any), Boolean (any), String matching regex (\\+|-)?\\d+(\\.\\d+)?. Returns false for all other types.',
  examples: [
    "'42'.convertsToDecimal()",
    "'3.14'.convertsToDecimal()",
    "true.convertsToDecimal()",
    "'invalid'.convertsToDecimal()"
  ],
  signatures: [
    {
      name: 'convertsToDecimal',
      input: { type: 'Any', singleton: true },
      parameters: [],
      result: { type: 'Boolean', singleton: true }
    }
  ],
  evaluate
};