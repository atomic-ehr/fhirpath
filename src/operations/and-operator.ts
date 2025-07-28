import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const andOperator: OperatorDefinition = {
  symbol: 'and',
  tokenType: 0,
  name: 'and',
  category: ['logical'],
  precedence: PRECEDENCE.AND,
  associativity: 'left',
  description: 'Logical AND operator',
  examples: ['active and verified'],
  signatures: []
};