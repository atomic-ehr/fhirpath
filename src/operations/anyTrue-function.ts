import type { FunctionDefinition, FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // Empty input returns false per spec
  if (input.length === 0) {
    return { value: [false], context };
  }
  
  // Check if any item in the collection is true
  for (const item of input) {
    if (typeof item !== 'boolean') {
      continue; // Skip non-boolean values
    }
    if (item === true) {
      return { value: [true], context };
    }
  }
  
  // All items are false or non-boolean
  return { value: [false], context };
};

export const anyTrueFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'anyTrue',
  category: ['existence'],
  description: 'Takes a collection of Boolean values and returns true if any of the items are true. If all the items are false, or if the input is empty, the result is false.',
  examples: [
    "Observation.component.select(value.value > 90).anyTrue()"
  ],
  signature: {
    input: { type: 'Boolean', singleton: false },
    parameters: [],
    result: { type: 'Boolean', singleton: true }
  },
  evaluate
};