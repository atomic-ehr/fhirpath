import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  if (args.length !== 1) {
    throw Errors.wrongArgumentCount('exclude', 1, args.length);
  }

  // Evaluate the argument to get the other collection
  const argNode = args[0];
  if (!argNode) {
    throw Errors.invalidOperation('exclude requires an argument');
  }
  const otherResult = evaluator(argNode, input, context);
  const other = otherResult.value;

  // Return elements from input that are not in other collection
  // Preserves duplicates and order
  const result: any[] = [];
  
  // Check each item from input collection
  for (const boxedItem of input) {
    const item = unbox(boxedItem);
    // Check if item exists in other collection
    let foundInOther = false;
    for (const boxedOtherItem of other) {
      const otherItem = unbox(boxedOtherItem);
      // Use JSON.stringify for deep equality comparison
      if (JSON.stringify(item) === JSON.stringify(otherItem)) {
        foundInOther = true;
        break;
      }
    }
    
    // If not found in other collection, add to result (preserving boxing)
    if (!foundInOther) {
      result.push(boxedItem);
    }
  }
  
  return { value: result, context };
};

export const excludeFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'exclude',
  category: ['collection'],
  description: 'Returns the set of elements that are not in the other collection. Duplicate items will not be eliminated by this function, and order will be preserved.',
  examples: [
    '(1 | 2 | 3).exclude(2)',
    '{1, 2, 3, 4}.exclude({3, 4})',
    'Patient.identifier.exclude(Patient.contact.identifier)'
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