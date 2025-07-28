import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const notEqualOperator: OperatorDefinition = {
  symbol: '!=',
  name: 'notEqual',
  category: ['equality'],
  precedence: PRECEDENCE.EQUALITY,
  associativity: 'left',
  description: 'Not equal operator',
  examples: ['name != "John"'],
  signatures: []
};