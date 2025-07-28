import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const minusOperator: OperatorDefinition = {
  symbol: '-',
  tokenType: 0,
  name: 'minus',
  category: ['arithmetic'],
  precedence: PRECEDENCE.ADDITIVE,
  associativity: 'left',
  description: 'Subtraction operator',
  examples: ['10 - 3'],
  signatures: []
};

export const unaryMinusOperator: OperatorDefinition = {
  symbol: '-',
  tokenType: 0,
  name: 'unaryMinus',
  category: ['arithmetic'],
  precedence: PRECEDENCE.UNARY,
  associativity: 'right',
  description: 'Unary minus operator',
  examples: ['-5'],
  signatures: []
};