import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('children', 0, args.length);
  }
  
  // Implementation will be added later for interpreter
  // For now, return empty as placeholder
  return { value: [], context };
};

export const childrenFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'children',
  category: ['navigation'],
  description: 'Returns all immediate child nodes of all items in the input collection',
  examples: [
    'Patient.children()',
    'Observation.children().ofType(CodeableConcept)'
  ],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [],
    result: { type: 'Any', singleton: false }
  },
  evaluate
};