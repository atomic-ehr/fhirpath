import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const divideOperator: OperatorDefinition = {
  symbol: '/',
  name: 'divide',
  category: ['arithmetic'],
  precedence: PRECEDENCE.MULTIPLICATIVE,
  associativity: 'left',
  description: 'Division operator',
  examples: ['10 / 2', '7.5 / 1.5'],
  signatures: [{
    name: 'numeric-divide',
    left: { type: 'Decimal', singleton: true },
    right: { type: 'Decimal', singleton: true },
    result: { type: 'Decimal', singleton: true },
  }]
};