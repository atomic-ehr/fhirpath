import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const divideOperator: OperatorDefinition = {
  symbol: '/',
  tokenType: 0,
  name: 'divide',
  category: ['arithmetic'],
  precedence: PRECEDENCE.MULTIPLICATIVE,
  associativity: 'left',
  description: 'Division operator',
  examples: ['10 / 2'],
  signatures: []
};