import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const isOperator: OperatorDefinition = {
  symbol: 'is',
  tokenType: 0,
  name: 'is',
  category: ['type'],
  precedence: PRECEDENCE.AS_IS,
  associativity: 'left',
  description: 'Type test operator',
  examples: ['value is String'],
  signatures: []
};

export const asOperator: OperatorDefinition = {
  symbol: 'as',
  tokenType: 0,
  name: 'as',
  category: ['type'],
  precedence: PRECEDENCE.AS_IS,
  associativity: 'left',
  description: 'Type cast operator',
  examples: ['value as String'],
  signatures: []
};