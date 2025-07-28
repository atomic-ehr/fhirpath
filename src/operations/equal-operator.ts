import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const equalOperator: OperatorDefinition = {
  symbol: '=',
  tokenType: 0,
  name: 'equal',
  category: ['equality'],
  precedence: PRECEDENCE.EQUALITY,
  associativity: 'left',
  description: 'Equality operator',
  examples: ['name = "John"'],
  signatures: []
};