import type { FunctionDefinition, FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // If the input is empty, the result is true
  if (input.length === 0) {
    return { value: [true], context };
  }
  
  // Verify all inputs are booleans
  for (let i = 0; i < input.length; i++) {
    if (typeof input[i] !== 'boolean') {
      throw new Error(`allFalse() expects all items to be Boolean values, but item at index ${i} is ${typeof input[i]}`);
    }
  }
  
  // Return true if all items are false, false if any item is true
  const result = input.every(item => item === false);
  
  return { value: [result], context };
};

export const allFalseFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'allFalse',
  category: ['existence'],
  description: 'Takes a collection of Boolean values and returns true if all the items are false. If any items are true, the result is false. If the input is empty, the result is true.',
  examples: [
    "Observation.select(component.value > 90 'mm[Hg]').allFalse()"
  ],
  signature: {
    input: { type: 'Boolean', singleton: false },
    parameters: [],
    result: { type: 'Boolean', singleton: true }
  },
  evaluate
};