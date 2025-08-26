import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { equalQuantities, compareQuantities, type QuantityValue } from '../quantity-value';
import { box, unbox } from '../boxing';

export const evaluate: OperationEvaluator = async (input, context, left, right) => {
  // If either operand is empty, return empty
  if (left.length === 0 || right.length === 0) {
    return { value: [], context };
  }
  
  // Handle single item comparison
  if (left.length === 1 && right.length === 1) {
    const boxedl = left[0];
    if (!boxedl) return { value: [], context };
    const l = unbox(boxedl);
    const boxedr = right[0];
    if (!boxedr) return { value: [], context };
    const r = unbox(boxedr);
    
    // Check if both are quantities
    if (l && typeof l === 'object' && 'unit' in l && 
        r && typeof r === 'object' && 'unit' in r) {
      const comparison = compareQuantities(l as QuantityValue, r as QuantityValue);
      // If quantities are incomparable (different dimensions), return empty
      if (comparison === null) {
        return { value: [], context };
      }
      return { value: [box(comparison !== 0, { type: 'Boolean', singleton: true })], context };
    }
    
    return { value: [box(l !== r, { type: 'Boolean', singleton: true })], context };
  }
  
  // Handle multiple item comparison - order dependent
  // != is the opposite of =
  // Different lengths means not equal
  if (left.length !== right.length) {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }
  
  // Compare each item at the same index
  for (let i = 0; i < left.length; i++) {
    const boxedL = left[i];
    const boxedR = right[i];
    
    if (!boxedL || !boxedR) {
      return { value: [box(true, { type: 'Boolean', singleton: true })], context };
    }
    
    const l = unbox(boxedL);
    const r = unbox(boxedR);
    
    // Check if both are quantities
    if (l && typeof l === 'object' && 'unit' in l && 
        r && typeof r === 'object' && 'unit' in r) {
      const comparison = compareQuantities(l as QuantityValue, r as QuantityValue);
      // If quantities are incomparable or not equal, collections are not equal
      if (comparison === null || comparison !== 0) {
        return { value: [box(true, { type: 'Boolean', singleton: true })], context };
      }
    } else if (l !== r) {
      // For non-quantities, use strict equality
      return { value: [box(true, { type: 'Boolean', singleton: true })], context };
    }
  }
  
  // All items are equal at their respective positions, so collections are equal (return false for !=)
  return { value: [box(false, { type: 'Boolean', singleton: true })], context };
};

export const notEqualOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '!=',
  name: 'notEqual',
  category: ['equality'],
  precedence: PRECEDENCE.EQUALITY,
  associativity: 'left',
  description: 'The converse of the equals operator, returning true if equal returns false; false if equal returns true; and empty ({ }) if equal returns empty',
  examples: ['name != "John"', 'Patient.gender != "male"', '5 != 3'],
  signatures: [
    {
      name: 'not-equal',
      left: { type: 'Any', singleton: true },
      right: { type: 'Any', singleton: true },
      result: { type: 'Boolean', singleton: true },
    },
    {
      name: 'not-equal',
      left: { type: 'Any', singleton: false },
      right: { type: 'Any', singleton: false },
      result: { type: 'Boolean', singleton: true },
    }
  ],
  evaluate
};