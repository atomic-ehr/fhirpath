import type { FunctionDefinition, FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // Empty input returns false per spec
  if (input.length === 0) {
    return { value: [false], context };
  }
  
  // Check if any item in the collection is false
  for (const item of input) {
    if (typeof item !== 'boolean') {
      continue; // Skip non-boolean values
    }
    if (item === false) {
      return { value: [true], context };
    }
  }
  
  // All items are true or non-boolean
  return { value: [false], context };
};

export const anyFalseFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'anyFalse',
  category: ['existence'],
  description: 'Takes a collection of Boolean values and returns true if any of the items are false. If all the items are true, or if the input is empty, the result is false.',
  examples: [
    "Observation.select(component.value > 90 'mm[Hg]').anyFalse()"
  ],
  signature: {
    input: { type: 'Boolean', singleton: false },
    parameters: [],
    result: { type: 'Boolean', singleton: true }
  },
  evaluate
};