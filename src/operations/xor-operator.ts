import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const xorOperator: OperatorDefinition = {
  symbol: 'xor',
  name: 'xor',
  category: ['logical'],
  precedence: PRECEDENCE.XOR,
  associativity: 'left',
  description: 'Logical XOR operator',
  examples: ['a xor b'],
  signatures: []
};