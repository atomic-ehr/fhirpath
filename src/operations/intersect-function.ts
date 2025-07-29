import type { FunctionDefinition, FunctionEvaluator } from '../types';

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
  // Note: This uses JavaScript's === equality which may not handle
  // complex objects correctly. A full implementation would need deep equality
  // as specified in FHIRPath equals (=) semantics.
  const result: any[] = [];
  const processedItems = new Set<any>();
  
  // Check each item from input collection
  for (const item of input) {
    // Skip if we've already processed this item (to eliminate duplicates)
    let alreadyProcessed = false;
    for (const processed of processedItems) {
      if (processed === item) {
        alreadyProcessed = true;
        break;
      }
    }
    if (alreadyProcessed) {
      continue;
    }
    
    // Check if item exists in other collection
    let foundInOther = false;
    for (const otherItem of other) {
      if (item === otherItem) {
        foundInOther = true;
        break;
      }
    }
    
    // If found in both collections, add to result
    if (foundInOther) {
      result.push(item);
      processedItems.add(item);
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