import type { FunctionDefinition } from '../types';
import type { FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // Use Set to track unique values based on unboxed values
  const seen = new Set<string>();
  const uniqueBoxedItems: any[] = [];
  
  for (const boxedItem of input) {
    const item = unbox(boxedItem);
    // Use JSON.stringify for deep equality comparison
    const key = JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      uniqueBoxedItems.push(boxedItem);
    }
  }
  
  return { 
    value: uniqueBoxedItems, 
    context 
  };
};

export const distinctFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'distinct',
  category: ['collection'],
  description: 'Returns a collection containing only unique items',
  examples: ['Patient.name.given.distinct()'],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [],
    result: { type: 'Any', singleton: false },
  },
  evaluate
};