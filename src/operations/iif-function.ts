import type { FunctionDefinition } from '../types';
import type { FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  if (args.length < 2) {
    throw new Error('iif requires at least 2 arguments');
  }
  
  if (args.length > 3) {
    throw new Error('iif takes at most 3 arguments');
  }

  // Check for multiple items in input collection
  if (input.length > 1) {
    throw new Error('iif() can only be used on single item or empty collections');
  }

  // Always evaluate condition
  const condExpr = args[0];
  const thenExpr = args[1];
  const elseExpr = args[2]; // Optional
  
  if (!condExpr || !thenExpr) {
    throw new Error('iif requires condition and true-result arguments');
  }
  
  // When evaluating expressions within iif, ensure $this refers to the input
  // Create a new context with $this set to the current input
  const evalContext = {
    ...context,
    variables: {
      ...context.variables,
      '$this': input
    },
    input: input,
    focus: input
  };
  
  const condResult = evaluator(condExpr, input, evalContext);
  
  // Empty condition is treated as false
  if (condResult.value.length === 0) {
    // If no else expression provided, return empty
    if (!elseExpr) {
      return { value: [], context };
    }
    // Otherwise evaluate the else branch
    return evaluator(elseExpr, input, context);
  }

  const condition = condResult.value[0];
  
  // Check if condition is a boolean
  if (typeof condition !== 'boolean') {
    // Non-boolean criteria returns empty
    return { value: [], context };
  }
  
  // Evaluate only the needed branch (using the same context with $this set)
  if (condition === true) {
    return evaluator(thenExpr, input, evalContext);
  } else {
    // If no else expression provided, return empty
    if (!elseExpr) {
      return { value: [], context };
    }
    return evaluator(elseExpr, input, evalContext);
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
      { name: 'condition', expression: true, type: { type: 'Boolean', singleton: true } },
      { name: 'trueResult', expression: true, type: { type: 'Any', singleton: false } },
      { name: 'falseResult', expression: true, type: { type: 'Any', singleton: false }, optional: true },
    ],
    result: { type: 'Any', singleton: false },
  },
  evaluate
};