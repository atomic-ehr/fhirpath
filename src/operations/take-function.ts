import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // Validate arguments
  if (args.length !== 1) {
    throw Errors.wrongArgumentCount('take', 1, args.length);
  }

  // If input is empty, return empty collection
  if (input.length === 0) {
    return { value: [], context };
  }

  // Evaluate the num argument
  if (!args[0]) {
    throw Errors.argumentRequired('take', 'number argument');
  }
  const numResult = evaluator(args[0], input, context);
  
  // Validate that num is a singleton integer
  if (numResult.value.length !== 1) {
    throw Errors.invalidOperation('take argument must be a single value');
  }
  
  const boxedNum = numResult.value[0];
  if (!boxedNum) {
    throw Errors.invalidOperation('take argument must be a single value');
  }
  
  const num = unbox(boxedNum);
  
  // Check that num is an integer
  if (!Number.isInteger(num)) {
    throw Errors.invalidOperation('take argument must be an integer');
  }
  
  // If num is less than or equal to 0, return empty collection
  if (num <= 0) {
    return { value: [], context };
  }
  
  // Return the first num items (or all items if num is greater than length)
  const result = input.slice(0, num);
  
  return { value: result, context };
};

export const takeFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'take',
  category: ['subsetting'],
  description: 'Returns a collection containing the first num items in the input collection, or less if there are less than num items. If num is less than or equal to 0, or if the input collection is empty, take returns an empty collection.',
  examples: [
    "Patient.name.take(3)",
    "Observation.component.take(1)"
  ],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [
      { name: 'num', type: { type: 'Integer', singleton: true } }
    ],
    result: { type: 'Any', singleton: false }
  },
  evaluate
};