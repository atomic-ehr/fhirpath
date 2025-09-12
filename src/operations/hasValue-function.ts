import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { box, unbox } from '../interpreter/boxing';
import { isTemporalValue } from '../complex-types/temporal';

/**
 * hasValue() : Boolean
 * 
 * Returns true if the input collection contains a single value which is a FHIR primitive,
 * and it has a primitive value (e.g. as opposed to not having a value and just having extensions).
 * Otherwise, the return value is empty.
 * 
 * In FHIR, primitives can be represented as either:
 * 1. Simple values: "birthDate": "1974-12-25"
 * 2. Complex with extensions: "_birthDate": { "extension": [...] } (no value)
 * 3. Both: "birthDate": "1974-12-25" with "_birthDate": { "extension": [...] }
 * 
 * This function returns true only if there's an actual primitive value (cases 1 and 3).
 */
export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // Must be a single value
  if (input.length !== 1) {
    return { value: [], context };
  }
  
  const value = unbox(input[0]!);
  
  // Check if it's a primitive type with an actual value
  // Primitives in FHIR are: string, boolean, integer, decimal, uri, url, canonical,
  // base64Binary, instant, date, dateTime, time, code, oid, id, markdown, unsignedInt, positiveInt
  // In FHIRPath/JS, these map to: string, boolean, number, Date, DateTime, Time
  
  // Check for primitive JavaScript types
  if (value === null || value === undefined) {
    // No value present
    return { value: [], context };
  }
  
  // Empty string is considered as having no value in FHIR
  if (value === '') {
    return { value: [], context };
  }
  
  // Check if it's a primitive type
  const isPrimitive = 
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    value instanceof Date ||
    isTemporalValue(value); // FHIRDate, FHIRTime, FHIRDateTime are primitives
  
  if (!isPrimitive) {
    // Check if it's a FHIR element with a value property
    // This handles cases where we have an object representation of a primitive
    if (typeof value === 'object' && value !== null) {
      // If it's an object, it might be a FHIR element with extensions
      // In this case, we need to check if it has an actual value
      // For now, we'll treat any object as not having a primitive value
      // unless it's a recognized type like Date or temporal values
      return { value: [], context };
    }
  }
  
  // It's a primitive with a value
  return { value: [box(true, { type: 'Boolean', singleton: true })], context };
};

export const hasValueFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'hasValue',
  doesNotPropagateEmpty: true,
  category: ['existence'],
  description: 'Returns true if the input collection contains a single value which is a FHIR primitive, and it has a primitive value (e.g. as opposed to not having a value and just having extensions). Otherwise, the return value is empty.',
  examples: [
    'Patient.birthDate.hasValue()',
    'Patient.active.hasValue()',
    'Observation.valueQuantity.value.hasValue()'
  ],
  signatures: [{
    name: 'hasValue',
    input: { type: 'Any', singleton: false },
    parameters: [],
    result: { type: 'Boolean', singleton: true }
  }],
  evaluate
};