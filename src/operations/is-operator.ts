import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const isOperator: OperatorDefinition = {
  symbol: 'is',
  name: 'is',
  category: ['type'],
  precedence: PRECEDENCE.AS_IS,
  associativity: 'left',
  description: 'Type test operator',
  examples: ['value is String'],
  signatures: []
};