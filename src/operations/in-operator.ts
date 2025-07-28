import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const inOperator: OperatorDefinition = {
  symbol: 'in',
  tokenType: 0,
  name: 'in',
  category: ['membership'],
  precedence: PRECEDENCE.IN_CONTAINS,
  associativity: 'left',
  description: 'Membership test operator',
  examples: ['5 in list'],
  signatures: []
};