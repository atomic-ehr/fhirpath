import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  if (args.length !== 1) {
    throw Errors.wrongArgumentCount('subsetOf', 1, args.length);
  }

  // If the input collection is empty, the result is true
  if (input.length === 0) {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }

  // Evaluate the other collection argument
  const argNode = args[0];
  if (!argNode) {
    throw Errors.invalidOperation('subsetOf requires an argument');
  }
  // Evaluate the argument with the root context ($this), not the current input
  // This allows expressions like Patient.name.given to work correctly
  const rootInput = context.variables['$this'] || context.input;
  const otherResult = evaluator(argNode, rootInput, context);
  const other = otherResult.value;

  // If the other collection is empty but input is not, the result is false
  if (other.length === 0) {
    return { value: [box(false, { type: 'Boolean', singleton: true })], context };
  }

  // Check if all items in input are members of other using equals semantics
  for (const boxedInputItem of input) {
    const inputItem = unbox(boxedInputItem);
    let found = false;
    for (const boxedOtherItem of other) {
      const otherItem = unbox(boxedOtherItem);
      // Use deep equality for comparing items
      if (JSON.stringify(inputItem) === JSON.stringify(otherItem)) {
        found = true;
        break;
      }
    }
    // If any item is not found in other, return false
    if (!found) {
      return { value: [box(false, { type: 'Boolean', singleton: true })], context };
    }
  }

  // All items in input are members of other
  return { value: [box(true, { type: 'Boolean', singleton: true })], context };
};

export const subsetOfFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'subsetOf',
  category: ['existence'],
  description: 'Returns true if all items in the input collection are members of the collection passed as the other argument. Membership is determined using the equals (=) operation.',
  examples: [
    'MedicationRequest.contained.meta.tag.subsetOf(MedicationRequest.meta.tag)'
  ],
  signatures: [{

    name: 'subsetOf',
    input: { type: 'Any', singleton: false },
    parameters: [
      { name: 'other', type: { type: 'Any', singleton: false } }
    ],
    result: { type: 'Boolean', singleton: true }
  }],
  evaluate
};