import type { FunctionDefinition } from '../types';
import type { FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  if (args.length < 3) {
    throw new Error('iif requires 3 arguments');
  }

  // Always evaluate condition
  const condExpr = args[0];
  const thenExpr = args[1];
  const elseExpr = args[2];
  
  if (!condExpr || !thenExpr || !elseExpr) {
    throw new Error('iif requires all 3 arguments to be present');
  }
  
  const condResult = evaluator(condExpr, input, context);
  
  if (condResult.value.length === 0) {
    // Empty condition - return empty
    return { value: [], context };
  }

  const condition = condResult.value[0];
  
  // Evaluate only the needed branch
  if (condition === true) {
    return evaluator(thenExpr, input, context);
  } else {
    return evaluator(elseExpr, input, context);
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