import type { FunctionDefinition } from '../types';
import type { FunctionEvaluator } from '../types';
import { box, unbox } from '../interpreter/boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // Three-valued logic implementation
  if (input.length === 0) {
    // Empty collection returns empty
    return { value: [], context };
  }
  
  // Multiple values should throw an error per XML tests
  if (input.length > 1) {
    throw new Error('not() can only be applied to a single item');
  }
  
  const boxedValue = input[0];
  if (!boxedValue) {
    return { value: [], context };
  }
  
  const value = unbox(boxedValue);
  
  if (value === true) {
    return { value: [box(false, { type: 'Boolean', singleton: true })], context };
  }
  
  if (value === false) {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }
  
  // Non-boolean values: any non-empty collection is considered truthy
  // So not() returns false for any non-boolean value
  // This follows the XML test suite behavior
  return { value: [box(false, { type: 'Boolean', singleton: true })], context };
};

export const notFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'not',
  category: ['logical'],
  description: 'Returns true if the input collection evaluates to false, and false if it evaluates to true. Otherwise, the result is empty',
  examples: [
    'true.not()',
    '(5 = 5).not()',
    'Patient.active.not()'
  ],
  signatures: [{

    name: 'not',
    input: { type: 'Any', singleton: false },
    parameters: [],
    result: { type: 'Boolean', singleton: true },
  }],
  evaluate
};