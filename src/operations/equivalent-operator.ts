import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  // Empty collections are equivalent
  if (left.length === 0 && right.length === 0) {
    return { value: [true], context };
  }
  
  // Different sizes are not equivalent
  if (left.length !== right.length) {
    return { value: [false], context };
  }
  
  // For single items, check type-specific equivalence
  if (left.length === 1 && right.length === 1) {
    const l = left[0];
    const r = right[0];
    
    // String equivalence: case-insensitive with normalized whitespace
    if (typeof l === 'string' && typeof r === 'string') {
      const normalizeString = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
      return { value: [normalizeString(l) === normalizeString(r)], context };
    }
    
    // Number equivalence (for Integer and Decimal)
    if (typeof l === 'number' && typeof r === 'number') {
      // For decimals with different precision, round to least precise
      // This is a simplified implementation
      return { value: [Math.abs(l - r) < Number.EPSILON], context };
    }
    
    // Boolean equivalence
    if (typeof l === 'boolean' && typeof r === 'boolean') {
      return { value: [l === r], context };
    }
    
    // For complex types and other cases, use equality for now
    // TODO: Implement full equivalence logic for Date/DateTime/Time and complex types
    return { value: [l === r], context };
  }
  
  // For multiple items, comparison is order-independent
  // Create sorted copies for comparison
  // TODO: Implement proper order-independent comparison with recursive equivalence
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  
  for (let i = 0; i < leftSorted.length; i++) {
    if (leftSorted[i] !== rightSorted[i]) {
      return { value: [false], context };
    }
  }
  
  return { value: [true], context };
};

export const equivalentOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '~',
  name: 'equivalent',
  category: ['equality'],
  precedence: PRECEDENCE.EQUALITY,
  associativity: 'left',
  description: 'Returns true if the collections are the same. For single items: strings are compared case-insensitive with normalized whitespace, decimals are rounded to least precision, dates with different precision return false. For collections: order-independent comparison. Empty ~ empty returns true (unlike =)',
  examples: [
    "'abc' ~ 'ABC'",
    "1.0 ~ 1.00",
    "{ } ~ { }",
    "(1 | 2 | 3) ~ (3 | 2 | 1)",
    "@2012-01-01 ~ @2012-01"
  ],
  signatures: [
    {
      name: 'equivalent',
      left: { type: 'Any', singleton: false },
      right: { type: 'Any', singleton: false },
      result: { type: 'Boolean', singleton: true },
    }
  ],
  evaluate
};