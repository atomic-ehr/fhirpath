import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  // Three-valued logic for implies per spec truth table
  
  // Handle empty left operand
  if (left.length === 0) {
    if (right.length === 0) {
      return { value: [], context };  // empty implies empty = empty
    }
    const boxedRight = right[0];
    if (boxedRight && unbox(boxedRight) === false) {
      return { value: [], context };  // empty implies false = empty
    }
    return { value: [box(true, { type: 'Boolean', singleton: true })], context }; // empty implies true = true
  }
  
  const boxedLeft = left[0];
  if (!boxedLeft) {
    return { value: [], context };
  }
  
  const leftValue = unbox(boxedLeft);
  
  // Handle false left operand
  if (leftValue === false) {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context }; // false implies anything = true
  }
  
  // Handle true left operand
  if (leftValue === true) {
    if (right.length === 0) {
      return { value: [], context }; // true implies empty = empty
    }
    
    // true implies y = y (pass through the boxed right value)
    return { value: [right[0]!], context };
  }
  
  // Non-boolean left value returns empty
  return { value: [], context };
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