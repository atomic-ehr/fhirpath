import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { RuntimeContextManager } from '../interpreter';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // all() requires exactly one argument (the criteria expression)
  if (!args || args.length !== 1) {
    throw new Error('all() requires exactly one argument');
  }

  // If the input collection is empty, the result is true per spec
  if (input.length === 0) {
    return { value: [true], context };
  }

  const criteriaExpression = args[0];
  if (!criteriaExpression) {
    throw new Error('all() requires a criteria expression');
  }

  // Evaluate the criteria for each element in the input collection
  for (let i = 0; i < input.length; i++) {
    const item = input[i];
    
    // Create iterator context with $this and $index
    let tempContext = RuntimeContextManager.withIterator(context, item, i);
    tempContext = RuntimeContextManager.setVariable(tempContext, '$total', input.length);
    
    // Evaluate the criteria expression with the current item as context
    const result = evaluator(criteriaExpression, [item], tempContext);
    
    // Check if the result is truthy
    // If the result is empty or contains a falsy value, return false
    if (result.value.length === 0 || result.value[0] !== true) {
      return { value: [false], context };
    }
  }

  // All criteria evaluations were true
  return { value: [true], context };
};

export const allFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'all',
  category: ['existence'],
  description: 'Returns true if for every element in the input collection, criteria evaluates to true. Otherwise, the result is false. If the input collection is empty, the result is true.',
  examples: [
    "generalPractitioner.all($this.resolve() is Practitioner)"
  ],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [
      { name: 'criteria', type: { type: 'expression' } }
    ],
    result: { type: 'Boolean', singleton: true }
  },
  evaluate
};