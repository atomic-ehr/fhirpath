import type { FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { childrenFunction } from './children-function';

/**
 * descendants() - Returns all descendant nodes of items in the input collection
 * 
 * Per FHIRPath spec:
 * - Returns all descendants at any depth
 * - Does NOT include the input nodes themselves
 * - Equivalent to repeat(children())
 * - Ordering is undefined
 * 
 * Type analysis returns Any due to combinatorial explosion of possible types.
 * In practice, users filter with ofType() or where() to get specific types.
 */
export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('descendants', 0, args.length);
  }
  
  const results: any[] = [];
  const queue: any[] = [...input];
  
  // Breadth-first traversal using queue
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    // Get children through existing children() function
    const childrenResult = childrenFunction.evaluate(
      [current], 
      context, 
      [], 
      evaluator
    );
    
    // Add all children to results and queue for further processing
    for (const boxedChild of childrenResult.value) {
      results.push(boxedChild);
      queue.push(boxedChild);
    }
  }
  
  return { value: results, context };
};

export const descendantsFunction = {
  name: 'descendants',
  category: ['navigation'],
  description: 'Returns all descendant nodes at any depth (not including input nodes)',
  examples: [
    'Bundle.descendants().ofType(Reference)',
    'Patient.descendants().ofType(CodeableConcept)',
    'Questionnaire.descendants().linkId'
  ],
  signature: {
    input: { type: 'Any', singleton: false },
    parameters: [],
    result: { type: 'Any', singleton: false }
  },
  evaluate
};