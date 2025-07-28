import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const notEquivalentOperator: OperatorDefinition = {
  symbol: '!~',
  name: 'notEquivalent',
  category: ['equality'],
  precedence: PRECEDENCE.EQUALITY,
  associativity: 'left',
  description: 'Not equivalent operator',
  examples: ['value !~ other'],
  signatures: []
};