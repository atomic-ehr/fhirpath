import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  if (args.length !== 1) {
    throw Errors.wrongArgumentCount('union', 1, args.length);
  }

  // Evaluate the argument to get the other collection
  const argNode = args[0];
  if (!argNode) {
    throw Errors.invalidOperation('union requires an argument');
  }
  const otherResult = evaluator(argNode, input, context);
  const other = otherResult.value;

  // Merge the two collections and eliminate duplicates using equals (=) semantics
  const result: any[] = [];
  const processedItemsJson = new Set<string>();
  
  // Add items from input collection
  for (const boxedItem of input) {
    const item = unbox(boxedItem);
    const itemJson = JSON.stringify(item);
    
    if (!processedItemsJson.has(itemJson)) {
      result.push(boxedItem);
      processedItemsJson.add(itemJson);
    }
  }
  
  // Add items from other collection if not already present
  for (const boxedItem of other) {
    const item = unbox(boxedItem);
    const itemJson = JSON.stringify(item);
    
    if (!processedItemsJson.has(itemJson)) {
      result.push(boxedItem);
      processedItemsJson.add(itemJson);
    }
  }
  
  return { value: result, context };
};

export const unionFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'union',
  category: ['collection'],
  description: 'Merge the two collections into a single collection, eliminating any duplicate values (using equals (=) to determine equality). There is no expectation of order in the resulting collection.',
  examples: [
    '{1, 1, 2, 3}.union({2, 3})',
    'name.select(use.union(given))',
    'Patient.identifier.union(Patient.contact.identifier)'
  ],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [
      { name: 'other', type: { type: 'Any', singleton: false } }
    ],
    result: { type: 'Any', singleton: false }
  },
  evaluate
};