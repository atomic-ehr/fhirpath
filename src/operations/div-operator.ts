import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const divOperator: OperatorDefinition = {
  symbol: 'div',
  name: 'div',
  category: ['arithmetic'],
  precedence: PRECEDENCE.MULTIPLICATIVE,
  associativity: 'left',
  description: 'Integer division operator',
  examples: ['10 div 3'],
  signatures: []
};