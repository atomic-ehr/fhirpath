import type { FunctionDefinition } from '../types';
import type { FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // Three-valued logic implementation
  if (input.length === 0) {
    // Empty collection returns empty
    return { value: [], context };
  }
  
  if (input[0] === true) {
    return { value: [false], context };
  }
  
  if (input[0] === false) {
    return { value: [true], context };
  }
  
  // Non-boolean values return empty
  return { value: [], context };
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
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [],
    result: { type: 'Boolean', singleton: true },
  },
  evaluate
};