import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const inOperator: OperatorDefinition = {
  symbol: 'in',
  name: 'in',
  category: ['membership'],
  precedence: PRECEDENCE.IN_CONTAINS,
  associativity: 'left',
  description: 'Membership test operator',
  examples: ['5 in list'],
  signatures: []
};