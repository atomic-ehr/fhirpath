import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const notOperator: OperatorDefinition = {
  symbol: 'not',
  tokenType: 0,
  name: 'not',
  category: ['logical'],
  precedence: PRECEDENCE.UNARY,
  associativity: 'right',
  description: 'Logical NOT operator',
  examples: ['not active'],
  signatures: []
};