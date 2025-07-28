import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  // Empty collections are equivalent, so not-equivalent returns false
  if (left.length === 0 && right.length === 0) {
    return { value: [false], context };
  }
  
  // Different sizes are not equivalent, so not-equivalent returns true
  if (left.length !== right.length) {
    return { value: [true], context };
  }
  
  // For single items, check type-specific non-equivalence
  if (left.length === 1 && right.length === 1) {
    const l = left[0];
    const r = right[0];
    
    // String non-equivalence: case-insensitive with normalized whitespace
    if (typeof l === 'string' && typeof r === 'string') {
      const normalizeString = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
      return { value: [normalizeString(l) !== normalizeString(r)], context };
    }
    
    // Number non-equivalence (for Integer and Decimal)
    if (typeof l === 'number' && typeof r === 'number') {
      // For decimals with different precision, round to least precise
      // This is a simplified implementation
      return { value: [Math.abs(l - r) >= Number.EPSILON], context };
    }
    
    // Boolean non-equivalence
    if (typeof l === 'boolean' && typeof r === 'boolean') {
      return { value: [l !== r], context };
    }
    
    // For complex types and other cases, use inequality for now
    // TODO: Implement full non-equivalence logic for Date/DateTime/Time and complex types
    return { value: [l !== r], context };
  }
  
  // For multiple items, comparison is order-independent
  // Create sorted copies for comparison
  // TODO: Implement proper order-independent comparison with recursive equivalence
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  
  for (let i = 0; i < leftSorted.length; i++) {
    if (leftSorted[i] !== rightSorted[i]) {
      return { value: [true], context };
    }
  }
  
  return { value: [false], context };
};

export const notEquivalentOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '!~',
  name: 'notEquivalent',
  category: ['equality'],
  precedence: PRECEDENCE.EQUALITY,
  associativity: 'left',
  description: 'The converse of the equivalent operator, returning true if equivalent returns false and false if equivalent returns true. In other words, A !~ B is short-hand for (A ~ B).not()',
  examples: [
    "'abc' !~ 'ABC'",
    "1.0 !~ 1.01",
    "{ } !~ { }",
    "(1 | 2 | 3) !~ (3 | 2 | 1)",
    "@2012-01-01 !~ @2012-01"
  ],
  signatures: [
    {
      name: 'notEquivalent',
      left: { type: 'Any', singleton: false },
      right: { type: 'Any', singleton: false },
      result: { type: 'Boolean', singleton: true },
    }
  ],
  evaluate
};