import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  if (args.length !== 1) {
    throw new Error('supersetOf() requires exactly 1 argument');
  }

  // Evaluate the other collection argument
  const argNode = args[0];
  if (!argNode) {
    throw new Error('supersetOf() requires an argument');
  }
  // Evaluate the argument with the root context ($this), not the current input
  // This allows expressions like Patient.name.given to work correctly
  const rootInput = context.variables['$this'] || context.input;
  const otherResult = evaluator(argNode, rootInput, context);
  const other = otherResult.value;

  // If the other collection is empty, the result is true
  if (other.length === 0) {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }

  // If the input collection is empty but other is not, the result is false
  if (input.length === 0) {
    return { value: [box(false, { type: 'Boolean', singleton: true })], context };
  }

  // Check if all items in other are members of input using equals semantics
  for (const boxedOtherItem of other) {
    const otherItem = unbox(boxedOtherItem);
    let found = false;
    for (const boxedInputItem of input) {
      const inputItem = unbox(boxedInputItem);
      // Use deep equality for comparing items
      if (JSON.stringify(otherItem) === JSON.stringify(inputItem)) {
        found = true;
        break;
      }
    }
    // If any item from other is not found in input, return false
    if (!found) {
      return { value: [box(false, { type: 'Boolean', singleton: true })], context };
    }
  }

  // All items in other are members of input
  return { value: [box(true, { type: 'Boolean', singleton: true })], context };
};

export const supersetOfFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'supersetOf',
  category: ['existence'],
  description: 'Returns true if all items in the collection passed as the other argument are members of the input collection. Membership is determined using the equals (=) operation.',
  examples: [
    'MedicationRequest.contained.meta.tag.supersetOf(MedicationRequest.meta.tag)'
  ],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [
      { name: 'other', type: { type: 'Any', singleton: false } }
    ],
    result: { type: 'Boolean', singleton: true }
  },
  evaluate
};