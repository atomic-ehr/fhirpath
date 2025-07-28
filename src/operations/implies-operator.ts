import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  // Three-valued logic for implies per spec truth table
  
  // Handle empty left operand
  if (left.length === 0) {
    if (right.length === 0) {
      return { value: [], context };  // empty implies empty = empty
    }
    if (right[0] === false) {
      return { value: [], context };  // empty implies false = empty
    }
    return { value: [true], context }; // empty implies true = true
  }
  
  // Handle false left operand
  if (left[0] === false) {
    return { value: [true], context }; // false implies anything = true
  }
  
  // Handle true left operand
  if (right.length === 0) {
    return { value: [], context }; // true implies empty = empty
  }
  
  return { value: [right[0]], context }; // true implies y = y
};

export const impliesOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: 'implies',
  name: 'implies',
  category: ['logical'],
  precedence: PRECEDENCE.IMPLIES,
  associativity: 'right',
  description: 'If the left operand evaluates to true, returns the boolean evaluation of the right operand. If the left operand evaluates to false, returns true. Otherwise, returns true if the right operand evaluates to true, and empty ({ }) otherwise',
  examples: [
    'Patient.name.given.exists() implies Patient.name.family.exists()',
    'CareTeam.onBehalfOf.exists() implies (CareTeam.member.resolve() is Practitioner)',
    'StructureDefinition.contextInvariant.exists() implies StructureDefinition.type = \'Extension\''
  ],
  signatures: [{
    name: 'implies',
    left: { type: 'Boolean', singleton: true },
    right: { type: 'Boolean', singleton: true },
    result: { type: 'Boolean', singleton: true },
  }],
  evaluate
};