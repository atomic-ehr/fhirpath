import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const greaterOrEqualOperator: OperatorDefinition = {
  symbol: '>=',
  name: 'greaterOrEqual',
  category: ['comparison'],
  precedence: PRECEDENCE.COMPARISON,
  associativity: 'left',
  description: 'Greater than or equal operator',
  examples: ['age >= 18'],
  signatures: []
};