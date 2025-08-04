import type { FunctionDefinition } from '../types';
import { RuntimeContextManager } from '../interpreter';
import { type FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // No arguments - just check if input is not empty
  if (args.length === 0) {
    return { value: [box(input.length > 0, { type: 'Boolean', singleton: true })], context };
  }

  const condition = args[0];
  if (!condition) {
    throw new Error('exists function requires a condition argument');
  }

  // Process each item with modified context
  for (let i = 0; i < input.length; i++) {
    const boxedItem = input[i];
    if (!boxedItem) continue;
    const item = unbox(boxedItem);
    
    // Create iterator context with $this and $index
    let tempContext = RuntimeContextManager.withIterator(context, item, i);
    tempContext = RuntimeContextManager.setVariable(tempContext, '$total', input.length);

    // Evaluate condition with temporary context
    const condResult = evaluator(condition, [boxedItem], tempContext);
    
    // Return true if any item matches
    if (condResult.value.length > 0) {
      const resultValue = unbox(condResult.value[0]!);
      if (resultValue === true) {
        return { value: [box(true, { type: 'Boolean', singleton: true })], context };
      }
    }
  }

  return { value: [box(false, { type: 'Boolean', singleton: true })], context };
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