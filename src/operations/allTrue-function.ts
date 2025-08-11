import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // If the input is empty, the result is true
  if (input.length === 0) {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }
  
  // Verify all inputs are booleans (unbox first)
  for (let i = 0; i < input.length; i++) {
    const unboxedValue = unbox(input[i]!);
    if (typeof unboxedValue !== 'boolean') {
      throw Errors.booleanOperationOnNonBoolean('allTrue', i, `${typeof unboxedValue}`);
    }
  }
  
  // Return true if all items are true, false if any item is false
  const result = input.every(item => unbox(item) === true);
  
  return { value: [box(result, { type: 'Boolean', singleton: true })], context };
};

export const allTrueFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'allTrue',
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