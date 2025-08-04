import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  if (args.length !== 1) {
    throw new Error('intersect() requires exactly 1 argument');
  }

  // Evaluate the argument to get the other collection
  const argNode = args[0];
  if (!argNode) {
    throw new Error('intersect() requires an argument');
  }
  const otherResult = evaluator(argNode, input, context);
  const other = otherResult.value;

  // Find elements that are in both collections, eliminating duplicates
  // Use deep equality for comparison as specified in FHIRPath equals (=) semantics.
  const result: any[] = [];
  const processedItemsJson = new Set<string>();
  
  // Check each item from input collection
  for (const boxedItem of input) {
    const item = unbox(boxedItem);
    const itemJson = JSON.stringify(item);
    
    // Skip if we've already processed this item (to eliminate duplicates)
    if (processedItemsJson.has(itemJson)) {
      continue;
    }
    
    // Check if item exists in other collection
    let foundInOther = false;
    for (const boxedOtherItem of other) {
      const otherItem = unbox(boxedOtherItem);
      if (JSON.stringify(otherItem) === itemJson) {
        foundInOther = true;
        break;
      }
    }
    
    // If found in both collections, add to result (preserving boxing)
    if (foundInOther) {
      result.push(boxedItem);
      processedItemsJson.add(itemJson);
    }
  }
  
  return { value: result, context };
};

export const intersectFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'intersect',
  category: ['collection'],
  description: 'Returns the set of elements that are in both collections. Duplicate items will be eliminated by this function. Order of items is not guaranteed to be preserved in the result of this function.',
  examples: [
    '{1, 2, 3, 4}.intersect({3, 4, 5, 6})',
    'Patient.identifier.intersect(Patient.contact.identifier)'
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