import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const greaterOperator: OperatorDefinition = {
  symbol: '>',
  name: 'greater',
  category: ['comparison'],
  precedence: PRECEDENCE.COMPARISON,
  associativity: 'left',
  description: 'Greater than operator',
  examples: ['age > 18'],
  signatures: []
};