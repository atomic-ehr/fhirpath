import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const lessOperator: OperatorDefinition = {
  symbol: '<',
  name: 'less',
  category: ['comparison'],
  precedence: PRECEDENCE.COMPARISON,
  associativity: 'left',
  description: 'Less than operator',
  examples: ['age < 18'],
  signatures: []
};