import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const multiplyOperator: OperatorDefinition = {
  symbol: '*',
  tokenType: 0,
  name: 'multiply',
  category: ['arithmetic'],
  precedence: PRECEDENCE.MULTIPLICATIVE,
  associativity: 'left',
  description: 'Multiplication operator',
  examples: ['5 * 3'],
  signatures: []
};