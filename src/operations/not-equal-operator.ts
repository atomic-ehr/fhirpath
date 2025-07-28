import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const notEqualOperator: OperatorDefinition = {
  symbol: '!=',
  tokenType: 0,
  name: 'notEqual',
  category: ['equality'],
  precedence: PRECEDENCE.EQUALITY,
  associativity: 'left',
  description: 'Not equal operator',
  examples: ['name != "John"'],
  signatures: []
};