import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const containsOperator: OperatorDefinition = {
  symbol: 'contains',
  tokenType: 0,
  name: 'contains',
  category: ['membership'],
  precedence: PRECEDENCE.IN_CONTAINS,
  associativity: 'left',
  description: 'Contains operator',
  examples: ['list contains 5'],
  signatures: []
};