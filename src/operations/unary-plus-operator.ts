import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const unaryPlusOperator: OperatorDefinition = {
  symbol: '+',
  name: 'unaryPlus',
  category: ['arithmetic'],
  precedence: PRECEDENCE.UNARY,
  associativity: 'right',
  description: 'Unary plus operator',
  examples: ['+5'],
  signatures: []
};