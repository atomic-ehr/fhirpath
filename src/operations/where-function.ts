import type { FunctionDefinition, ASTNode } from '../types';
import { RuntimeContextManager } from '../interpreter';
import { type FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // If no condition provided, return input as-is
  if (args.length === 0) {
    return { value: input, context };
  }

  const condition = args[0];
  const results: any[] = [];

  // Process each item with modified context
  for (let i = 0; i < input.length; i++) {
    const item = input[i];
    
    // Create iterator context with $this and $index
    let tempContext = RuntimeContextManager.withIterator(context, item, i);
    tempContext = RuntimeContextManager.setVariable(tempContext, '$total', input.length);

    if (!condition) {
      results.push(item);
      continue;
    }

    // Evaluate condition with temporary context
    const condResult = evaluator(condition, [item], tempContext);
    
    // Include item if condition is true
    if (condResult.value.length > 0 && condResult.value[0] === true) {
      results.push(item);
    }
  }

  return { value: results, context };  // Original context restored
};

export const whereFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'where',
  category: ['logical'],
  description: 'Logical where operator',
  examples: ['a where b'],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [
      { name: 'condition', type: { type: 'Boolean', singleton: false } },
    ],
    result: { type: 'Any', singleton: false },
  },
  evaluate
};