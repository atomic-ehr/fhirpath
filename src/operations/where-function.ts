import type { FunctionDefinition, ASTNode } from '../types';
import { RuntimeContextManager } from '../interpreter';
import { type FunctionEvaluator } from '../types';
import { unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // If no condition provided, return input as-is
  if (args.length === 0) {
    return { value: input, context };
  }

  const condition = args[0];
  const results: any[] = [];

  // Process each boxed item with modified context
  for (let i = 0; i < input.length; i++) {
    const boxedItem = input[i];
    if (!boxedItem) continue;
    
    const item = unbox(boxedItem);
    
    // Create iterator context with $this and $index
    let tempContext = RuntimeContextManager.withIterator(context, item, i);
    tempContext = RuntimeContextManager.setVariable(tempContext, '$total', input.length);

    if (!condition) {
      results.push(boxedItem);
      continue;
    }

    // Evaluate condition with temporary context (passing boxed item)
    const condResult = evaluator(condition, [boxedItem], tempContext);
    
    // Include item if condition is true (unbox the boolean result)
    if (condResult.value.length > 0) {
      const condValue = unbox(condResult.value[0]!);
      if (condValue === true) {
        results.push(boxedItem);
      }
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
      { name: 'condition', type: { type: 'Boolean', singleton: false }, expression: true },
    ],
    result: 'inputType' as any,
  },
  evaluate
};