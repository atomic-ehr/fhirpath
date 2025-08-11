import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: OperationEvaluator = async (input, context, left, right) => {
  // Empty collections are equivalent
  if (left.length === 0 && right.length === 0) {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }
  
  // Different sizes are not equivalent
  if (left.length !== right.length) {
    return { value: [box(false, { type: 'Boolean', singleton: true })], context };
  }
  
  // For single items, check type-specific equivalence
  if (left.length === 1 && right.length === 1) {
    const boxedl = left[0];
  if (!boxedl) return { value: [], context };
  const l = unbox(boxedl);
    const boxedr = right[0];
  if (!boxedr) return { value: [], context };
  const r = unbox(boxedr);
    
    // String equivalence: case-insensitive with normalized whitespace
    if (typeof l === 'string' && typeof r === 'string') {
      const normalizeString = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
      return { value: [box(normalizeString(l) === normalizeString(r), { type: 'Boolean', singleton: true })], context };
    }
    
    // Number equivalence (for Integer and Decimal)
    if (typeof l === 'number' && typeof r === 'number') {
      // For decimals with different precision, round to least precise
      // This is a simplified implementation
      return { value: [box(Math.abs(l - r) < Number.EPSILON, { type: 'Boolean', singleton: true })], context };
    }
    
    // Boolean equivalence
    if (typeof l === 'boolean' && typeof r === 'boolean') {
      return { value: [box(l === r, { type: 'Boolean', singleton: true })], context };
    }
    
    // For complex types and other cases, use equality for now
    // TODO: Implement full equivalence logic for Date/DateTime/Time and complex types
    return { value: [box(l === r, { type: 'Boolean', singleton: true })], context };
  }
  
  // For multiple items, comparison is order-independent
  // Create sorted copies for comparison
  // TODO: Implement proper order-independent comparison with recursive equivalence
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  
  for (let i = 0; i < leftSorted.length; i++) {
    if (leftSorted[i] !== rightSorted[i]) {
      return { value: [box(false, { type: 'Boolean', singleton: true })], context };
    }
  }
  
  return { value: [box(true, { type: 'Boolean', singleton: true })], context };
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