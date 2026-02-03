import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { box, unbox, type FHIRPathValue } from '../interpreter/boxing';

/**
 * SQL on FHIR: getResourceKey()
 *
 * Returns a unique key identifying this resource for use in database joins.
 * The returned value is implementation-dependent but must be a FHIR primitive
 * type suitable for efficient joins.
 *
 * This function is designed to work with getReferenceKey() - the value returned
 * by getResourceKey() on a resource must equal the value returned by
 * getReferenceKey() on references pointing to that resource.
 *
 * @see https://build.fhir.org/ig/FHIR/sql-on-fhir-v2/functional-model.html
 */
export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  const results: FHIRPathValue<string>[] = [];

  for (const boxedItem of input) {
    const item = unbox(boxedItem);

    // Extract resource key - implementation uses resource id
    if (item && typeof item === 'object') {
      // Check for FHIR resource with id
      if ('id' in item && item.id !== undefined) {
        results.push(box(String(item.id), { type: 'String', singleton: true }));
      }
      // Empty collection if no id found
    }
  }

  return { value: results, context };
};

export const getResourceKeyFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'getResourceKey',
  category: ['SQL on FHIR', 'navigation'],
  description:
    'Returns a unique key identifying this resource for use in database joins. ' +
    'The returned value can be used with getReferenceKey() to join resources. ' +
    'This is typically the resource id, but the exact format is implementation-dependent.',
  examples: [
    'getResourceKey()',
    'Patient.getResourceKey()',
  ],
  signatures: [{
    name: 'getResourceKey',
    input: { type: 'Any', singleton: false },
    parameters: [],
    result: { type: 'String', singleton: false },
  }],
  evaluate,
};
