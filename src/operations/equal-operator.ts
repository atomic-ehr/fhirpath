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
    const boxedL = left[0];
    const boxedR = right[0];
    
    if (!boxedL || !boxedR) {
      return { value: [], context };
    }
    
    const l = unbox(boxedL);
    const r = unbox(boxedR);
    
    // Check if both are quantities
    if (l && typeof l === 'object' && 'unit' in l && 
        r && typeof r === 'object' && 'unit' in r) {
      const comparison = compareQuantities(l as QuantityValue, r as QuantityValue);
      // If quantities are incomparable (different dimensions), return empty
      if (comparison === null) {
        return { value: [], context };
      }
      return { value: [box(comparison === 0, { type: 'Boolean', singleton: true })], context };
    }
    
    // Check if one is a dimensionless quantity and the other is a number
    if (l && typeof l === 'object' && 'unit' in l && typeof r === 'number') {
      const quantity = l as QuantityValue;
      // Dimensionless quantities have unit '1' or empty string
      if (quantity.unit === '1' || quantity.unit === '') {
        return { value: [box(quantity.value === r, { type: 'Boolean', singleton: true })], context };
      }
      // Non-dimensionless quantity compared to number returns empty
      return { value: [], context };
    }
    if (typeof l === 'number' && r && typeof r === 'object' && 'unit' in r) {
      const quantity = r as QuantityValue;
      // Dimensionless quantities have unit '1' or empty string
      if (quantity.unit === '1' || quantity.unit === '') {
        return { value: [box(l === quantity.value, { type: 'Boolean', singleton: true })], context };
      }
      // Number compared to non-dimensionless quantity returns empty
      return { value: [], context };
    }
    
    // Check if both are temporal values (Date, DateTime, Time)
    if (l && typeof l === 'object' && 'type' in l && 'equals' in l &&
        r && typeof r === 'object' && 'type' in r && 'equals' in r) {
      const temporalL = l as any; // Has type and equals method
      const temporalR = r as any;
      if (['Date', 'DateTime', 'Time'].includes(temporalL.type) &&
          ['Date', 'DateTime', 'Time'].includes(temporalR.type)) {
        const result = temporalL.equals(temporalR);
        // null means incomparable (returns empty), false means not equal, true means equal
        if (result === null) {
          return { value: [], context };
        }
        return { value: [box(result, { type: 'Boolean', singleton: true })], context };
      }
    }
    
    return { value: [box(l === r, { type: 'Boolean', singleton: true })], context };
  }
  
  // Handle multiple item comparison - order dependent
  // According to spec: "If both operands are collections with multiple items:
  // - Each item must be equal
  // - Comparison is order dependent"
  
  // Different lengths means not equal
  if (left.length !== right.length) {
    return { value: [box(false, { type: 'Boolean', singleton: true })], context };
  }
  
  // Compare each item at the same index
  for (let i = 0; i < left.length; i++) {
    const boxedL = left[i];
    const boxedR = right[i];
    
    if (!boxedL || !boxedR) {
      return { value: [box(false, { type: 'Boolean', singleton: true })], context };
    }
    
    const l = unbox(boxedL);
    const r = unbox(boxedR);
    
    // Check if both are quantities
    if (l && typeof l === 'object' && 'unit' in l && 
        r && typeof r === 'object' && 'unit' in r) {
      const comparison = compareQuantities(l as QuantityValue, r as QuantityValue);
      // If quantities are incomparable or not equal, return false
      if (comparison === null || comparison !== 0) {
        return { value: [box(false, { type: 'Boolean', singleton: true })], context };
      }
    } else if (l && typeof l === 'object' && 'type' in l && 'equals' in l &&
               r && typeof r === 'object' && 'type' in r && 'equals' in r) {
      // Check if both are temporal values
      const temporalL = l as any;
      const temporalR = r as any;
      if (['Date', 'DateTime', 'Time'].includes(temporalL.type) &&
          ['Date', 'DateTime', 'Time'].includes(temporalR.type)) {
        const result = temporalL.equals(temporalR);
        // null means incomparable (returns empty for single comparison, false for collection)
        // false means not equal
        if (result !== true) {
          return { value: [box(false, { type: 'Boolean', singleton: true })], context };
        }
      } else if (l !== r) {
        return { value: [box(false, { type: 'Boolean', singleton: true })], context };
      }
    } else if (l !== r) {
      // For non-quantities, use strict equality
      return { value: [box(false, { type: 'Boolean', singleton: true })], context };
    }
  }
  
  // All items are equal at their respective positions
  return { value: [box(true, { type: 'Boolean', singleton: true })], context };
};

export const equalOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '=',
  name: 'equal',
  category: ['equality'],
  precedence: PRECEDENCE.EQUALITY,
  associativity: 'left',
  description: 'Returns true if the left collection is equal to the right collection. For single items, comparison is type-specific. For collections, comparison is order-dependent.',
  examples: ['name = "John"', 'Patient.name.given = "John"', '5 = 5', '@2018-03-01 = @2018-03-01'],
  signatures: [
    {
      name: 'equal',
      left: { type: 'Any', singleton: true },
      right: { type: 'Any', singleton: true },
      result: { type: 'Boolean', singleton: true },
    },
    {
      name: 'equal',
      left: { type: 'Any', singleton: false },
      right: { type: 'Any', singleton: false },
      result: { type: 'Boolean', singleton: true },
    }
  ],
  evaluate
};