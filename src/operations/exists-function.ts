import type { FunctionDefinition } from '../types';
import { RuntimeContextManager } from '../interpreter';
import { type FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // No arguments - just check if input is not empty
  if (args.length === 0) {
    return { value: [input.length > 0], context };
  }

  const condition = args[0];

  // Process each item with modified context
  for (let i = 0; i < input.length; i++) {
    const item = input[i];
    
    // Create iterator context with $this and $index
    let tempContext = RuntimeContextManager.withIterator(context, item, i);
    tempContext = RuntimeContextManager.setSpecialVariable(tempContext, 'total', input.length);

    // Evaluate condition with temporary context
    const condResult = evaluator(condition, [item], tempContext);
    
    // Return true if any item matches
    if (condResult.value.length > 0 && condResult.value[0] === true) {
      return { value: [true], context };
    }
  }

  return { value: [false], context };
};

export const existsFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'exists',
  category: ['collection', 'logical'],
  description: 'Returns true if the collection has any items, or if any item satisfies the condition',
  examples: ['Patient.name.exists()', 'Patient.name.exists(use = "official")'],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [
      { name: 'condition', optional: true, type: { type: 'Boolean', singleton: false } },
    ],
    result: { type: 'Boolean', singleton: true },
  },
  evaluate
};