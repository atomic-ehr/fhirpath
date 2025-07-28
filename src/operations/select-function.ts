import type { FunctionDefinition } from '../types';
import { RuntimeContextManager } from '../interpreter';
import { type FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // If no expression provided, return input as-is
  if (args.length === 0) {
    return { value: input, context };
  }

  const expression = args[0];
  const results: any[] = [];

  // Process each item with modified context
  for (let i = 0; i < input.length; i++) {
    const item = input[i];
    
    // Create iterator context with $this and $index
    let tempContext = RuntimeContextManager.withIterator(context, item, i);
    tempContext = RuntimeContextManager.setSpecialVariable(tempContext, 'total', input.length);

    // Evaluate expression with temporary context
    const exprResult = evaluator(expression, [item], tempContext);
    results.push(...exprResult.value);
  }

  return { value: results, context };  // Original context restored
};

export const selectFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'select',
  category: ['collection'],
  description: 'Projects each item in the input collection through an expression',
  examples: ['Patient.name.select(given.first())'],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [
      { name: 'expression', type: { type: 'Any', singleton: false } },
    ],
    result: { type: 'Any', singleton: false },
  },
  evaluate
};