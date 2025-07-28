import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const asOperator: OperatorDefinition = {
  symbol: 'as',
  name: 'as',
  category: ['type'],
  precedence: PRECEDENCE.AS_IS,
  associativity: 'left',
  description: 'Type cast operator',
  examples: ['value as String'],
  signatures: []
};