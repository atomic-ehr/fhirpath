import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const modOperator: OperatorDefinition = {
  symbol: 'mod',
  tokenType: 0,
  name: 'mod',
  category: ['arithmetic'],
  precedence: PRECEDENCE.MULTIPLICATIVE,
  associativity: 'left',
  description: 'Modulo operator',
  examples: ['10 mod 3'],
  signatures: []
};