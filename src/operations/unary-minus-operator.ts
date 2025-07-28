import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const unaryMinusOperator: OperatorDefinition = {
  symbol: '-',
  name: 'unaryMinus',
  category: ['arithmetic'],
  precedence: PRECEDENCE.UNARY,
  associativity: 'right',
  description: 'Unary minus operator',
  examples: ['-5'],
  signatures: []
};