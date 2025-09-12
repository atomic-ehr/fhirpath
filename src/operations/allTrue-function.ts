import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../interpreter/boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // If the input is empty, the result is true
  if (input.length === 0) {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }
  
  // Check all items: return false if any item is non-boolean or false
  // Return true only if ALL items are boolean true
  const result = input.every(item => {
    const unboxedValue = unbox(item);
    return unboxedValue === true;  // This will return false for non-booleans or false values
  });
  
  return { value: [box(result, { type: 'Boolean', singleton: true })], context };
};

export const allTrueFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'allTrue',
  doesNotPropagateEmpty: true,
  category: ['existence'],
  description: 'Takes a collection of Boolean values and returns true if all the items are true. If any items are false, the result is false. If the input is empty, the result is true.',
  examples: [
    "Observation.select(component.value > 90 'mm[Hg]').allTrue()"
  ],
  signatures: [{

    name: 'allTrue',
    input: { type: 'Boolean', singleton: false },
    parameters: [],
    result: { type: 'Boolean', singleton: true }
  }],
  evaluate
};