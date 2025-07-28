import type { FunctionDefinition } from '../types';
import type { FunctionEvaluator } from '../interpreter';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  if (args.length < 3) {
    throw new Error('iif requires 3 arguments');
  }

  // Always evaluate condition
  const condResult = evaluator(args[0], input, context);
  
  if (condResult.value.length === 0) {
    // Empty condition - return empty
    return { value: [], context };
  }

  const condition = condResult.value[0];
  
  // Evaluate only the needed branch
  if (condition === true) {
    return evaluator(args[1], input, context);
  } else {
    return evaluator(args[2], input, context);
  }
};

export const iifFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'iif',
  category: ['control'],
  description: 'If-then-else expression (immediate if)',
  examples: ['iif(gender = "male", "Mr.", "Ms.")'],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [
      { name: 'condition', type: { type: 'Boolean', singleton: true } },
      { name: 'trueResult', type: { type: 'Any', singleton: false } },
      { name: 'falseResult', type: { type: 'Any', singleton: false } },
    ],
    result: { type: 'Any', singleton: false },
  },
  evaluate
};