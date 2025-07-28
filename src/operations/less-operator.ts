import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const lessOperator: OperatorDefinition = {
  symbol: '<',
  tokenType: 0,
  name: 'less',
  category: ['comparison'],
  precedence: PRECEDENCE.COMPARISON,
  associativity: 'left',
  description: 'Less than operator',
  examples: ['age < 18'],
  signatures: []
};