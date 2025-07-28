import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../interpreter';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  if (left.length === 0 || right.length === 0) {
    return { value: [], context };
  }
  
  const l = left[0];
  const r = right[0];
  
  if (typeof l === 'string' || typeof r === 'string') {
    return { value: [String(l) + String(r)], context };
  }
  
  if (typeof l === 'number' && typeof r === 'number') {
    return { value: [l + r], context };
  }
  
  // For other types, convert to string
  return { value: [String(l) + String(r)], context };
};

export const plusOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '+',
  name: 'plus',
  category: ['arithmetic'],
  precedence: PRECEDENCE.ADDITIVE,
  associativity: 'left',
  description: 'Addition operator',
  examples: ['2 + 3', '"Hello" + " " + "World"'],
  signatures: [
    {
      name: 'numeric-plus',
      left: { type: 'Decimal', singleton: true },
      right: { type: 'Decimal', singleton: true },
      result: { type: 'Decimal', singleton: true },
    },
    {
      name: 'string-plus',
      left: { type: 'String', singleton: true },
      right: { type: 'String', singleton: true },
      result: { type: 'String', singleton: true },
    }
  ],
  evaluate
};