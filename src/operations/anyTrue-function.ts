import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // Empty input returns false per spec
  if (input.length === 0) {
    return { value: [box(false, { type: 'Boolean', singleton: true })], context };
  }
  
  // Check if any item in the collection is true
  for (const boxedItem of input) {
    const item = unbox(boxedItem);
    if (typeof item !== 'boolean') {
      continue; // Skip non-boolean values
    }
    if (item === true) {
      return { value: [box(true, { type: 'Boolean', singleton: true })], context };
    }
  }
  
  // All items are false or non-boolean
  return { value: [box(false, { type: 'Boolean', singleton: true })], context };
};

export const anyTrueFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'anyTrue',
  category: ['existence'],
  description: 'Takes a collection of Boolean values and returns true if any of the items are true. If all the items are false, or if the input is empty, the result is false.',
  examples: [
    "Observation.component.select(value.value > 90).anyTrue()"
  ],
  signatures: [{

    name: 'anyTrue',
    input: { type: 'Boolean', singleton: false },
    parameters: [],
    result: { type: 'Boolean', singleton: true }
  }],
  evaluate
};