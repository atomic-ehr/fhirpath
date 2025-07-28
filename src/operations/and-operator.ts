import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const andOperator: OperatorDefinition = {
  symbol: 'and',
  name: 'and',
  category: ['logical'],
  precedence: PRECEDENCE.AND,
  associativity: 'left',
  description: 'Logical AND operator',
  examples: ['active and verified'],
  signatures: []
};