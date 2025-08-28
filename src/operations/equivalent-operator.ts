import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { box } from '../boxing';
import { collectionsEquivalent } from '../comparison';

export const evaluate: OperationEvaluator = async (input, context, left, right) => {
  // Use the new collectionsEquivalent function from comparison.ts
  const result = collectionsEquivalent(left, right);
  
  // null result means incomparable - return empty collection
  if (result === null) {
    return { value: [], context };
  }
  
  // Return boolean result
  return {
    value: [box(result, { type: 'Boolean', singleton: true })],
    context
  };
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