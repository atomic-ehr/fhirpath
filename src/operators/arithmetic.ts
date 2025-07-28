import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const divOperator: OperatorDefinition = {
  symbol: 'div',
  tokenType: 0,
  name: 'div',
  category: ['arithmetic'],
  precedence: PRECEDENCE.MULTIPLICATIVE,
  associativity: 'left',
  description: 'Integer division operator',
  examples: ['10 div 3'],
  signatures: []
};

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