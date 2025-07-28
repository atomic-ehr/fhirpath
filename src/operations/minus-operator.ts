import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const minusOperator: OperatorDefinition = {
  symbol: '-',
  name: 'minus',
  category: ['arithmetic'],
  precedence: PRECEDENCE.ADDITIVE,
  associativity: 'left',
  description: 'Subtraction operator',
  examples: ['5 - 3', '10.5 - 2.5'],
  signatures: [{
    name: 'numeric-minus',
    left: { type: 'Decimal', singleton: true },
    right: { type: 'Decimal', singleton: true },
    result: { type: 'Decimal', singleton: true },
  }]
};