import type { FunctionDefinition, FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // If the input is empty, the result is true
  if (input.length === 0) {
    return { value: [true], context };
  }
  
  // Verify all inputs are booleans
  for (let i = 0; i < input.length; i++) {
    if (typeof input[i] !== 'boolean') {
      throw new Error(`allTrue() expects all items to be Boolean values, but item at index ${i} is ${typeof input[i]}`);
    }
  }
  
  // Return true if all items are true, false if any item is false
  const result = input.every(item => item === true);
  
  return { value: [result], context };
};

export const allTrueFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'allTrue',
  category: ['existence'],
  description: 'Takes a collection of Boolean values and returns true if all the items are true. If any items are false, the result is false. If the input is empty, the result is true.',
  examples: [
    "Observation.select(component.value > 90 'mm[Hg]').allTrue()"
  ],
  signature: {
    input: { type: 'Boolean', singleton: false },
    parameters: [],
    result: { type: 'Boolean', singleton: true }
  },
  evaluate
};