import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { box } from '../boxing';
import { collectionsNotEquivalent } from '../comparison';

export const evaluate: OperationEvaluator = async (input, context, left, right) => {
  // Use the new collectionsNotEquivalent function from comparison.ts
  const result = collectionsNotEquivalent(left, right);
  
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