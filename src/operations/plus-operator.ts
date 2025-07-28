import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const plusOperator: OperatorDefinition = {
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
};