import type { FunctionDefinition, FunctionEvaluator } from '../types';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  if (args.length !== 1) {
    throw new Error('subsetOf() requires exactly 1 argument');
  }

  // If the input collection is empty, the result is true
  if (input.length === 0) {
    return { value: [true], context };
  }

  // Evaluate the other collection argument
  const argNode = args[0];
  if (!argNode) {
    throw new Error('subsetOf() requires an argument');
  }
  // Evaluate the argument with the root context ($this), not the current input
  // This allows expressions like Patient.name.given to work correctly
  const rootInput = context.variables['$this'] || context.input;
  const otherResult = evaluator(argNode, rootInput, context);
  const other = otherResult.value;

  // If the other collection is empty but input is not, the result is false
  if (other.length === 0) {
    return { value: [false], context };
  }

  // Check if all items in input are members of other using equals semantics
  for (const inputItem of input) {
    let found = false;
    for (const otherItem of other) {
      // Use JavaScript === for now, matching the equals operator behavior
      // A full implementation would need deep equality as specified in FHIRPath
      if (inputItem === otherItem) {
        found = true;
        break;
      }
    }
    // If any item is not found in other, return false
    if (!found) {
      return { value: [false], context };
    }
  }

  // All items in input are members of other
  return { value: [true], context };
};

export const subsetOfFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'subsetOf',
  category: ['existence'],
  description: 'Returns true if all items in the input collection are members of the collection passed as the other argument. Membership is determined using the equals (=) operation.',
  examples: [
    'MedicationRequest.contained.meta.tag.subsetOf(MedicationRequest.meta.tag)'
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