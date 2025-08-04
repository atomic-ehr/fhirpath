import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // trace() requires at least a name argument
  if (args.length === 0) {
    // If no name provided, use a default name
    console.log('[FHIRPath trace] (unnamed):', JSON.stringify(input));
    return { value: input, context };
  }
  
  if (args.length > 2) {
    throw new Error('trace() takes at most 2 arguments');
  }

  // Evaluate the name argument
  if (!args[0]) {
    throw new Error('trace() requires a name argument');
  }
  const nameResult = evaluator(args[0], input, context);
  
  // Validate that name is a singleton string
  if (nameResult.value.length !== 1) {
    throw new Error('trace() name argument must be a single value');
  }
  
  const boxedName = nameResult.value[0];
  if (!boxedName) {
    throw new Error('trace() name argument must be a string');
  }
  
  const name = unbox(boxedName);
  if (typeof name !== 'string') {
    throw new Error('trace() name argument must be a string');
  }

  // If projection argument is provided, evaluate it and log the result
  if (args.length === 2 && args[1]) {
    const projectionResult = evaluator(args[1], input, context);
    console.log(`[FHIRPath trace] ${name}:`, JSON.stringify(projectionResult.value));
  } else {
    // Otherwise log the input
    console.log(`[FHIRPath trace] ${name}:`, JSON.stringify(input));
  }

  // Always return the input unchanged
  return { value: input, context };
};

export const traceFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'trace',
  category: ['utility'],
  description: 'Adds a String representation of the input collection to the diagnostic log, using the name argument as the name in the log. Does not change the input, so returns the input collection as output.',
  examples: [
    "contained.where(criteria).trace('unmatched', id).empty()",
    "name.given.trace('test').count()"
  ],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [
      { name: 'name', type: { type: 'String', singleton: true } },
      { name: 'projection', type: { type: 'Any', singleton: false }, optional: true }
    ],
    result: { type: 'Any', singleton: false }
  },
  evaluate
};