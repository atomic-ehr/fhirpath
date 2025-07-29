import type { FunctionDefinition, FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  if (args.length !== 1) {
    throw new Error('union() requires exactly 1 argument');
  }

  // Evaluate the argument to get the other collection
  const argNode = args[0];
  if (!argNode) {
    throw new Error('union() requires an argument');
  }
  const otherResult = evaluator(argNode, input, context);
  const other = otherResult.value;

  // Merge the two collections and eliminate duplicates using equals (=) semantics
  const result: any[] = [];
  
  // Add items from input collection
  for (const item of input) {
    let isDuplicate = false;
    for (const existing of result) {
      // Use equals operator semantics for duplicate detection
      if (existing === item) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) {
      result.push(item);
    }
  }
  
  // Add items from other collection if not already present
  for (const item of other) {
    let isDuplicate = false;
    for (const existing of result) {
      // Use equals operator semantics for duplicate detection
      if (existing === item) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) {
      result.push(item);
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