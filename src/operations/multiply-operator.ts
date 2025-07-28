import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const multiplyOperator: OperatorDefinition = {
  symbol: '*',
  name: 'multiply',
  category: ['arithmetic'],
  precedence: PRECEDENCE.MULTIPLICATIVE,
  associativity: 'left',
  description: 'Multiplication operator',
  examples: ['2 * 3', '5.5 * 2'],
  signatures: [{
    name: 'numeric-multiply',
    left: { type: 'Decimal', singleton: true },
    right: { type: 'Decimal', singleton: true },
    result: { type: 'Decimal', singleton: true },
  }]
};