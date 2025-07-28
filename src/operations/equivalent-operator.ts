import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const equivalentOperator: OperatorDefinition = {
  symbol: '~',
  tokenType: 0,
  name: 'equivalent',
  category: ['equality'],
  precedence: PRECEDENCE.EQUALITY,
  associativity: 'left',
  description: 'Equivalence operator',
  examples: ['value ~ other'],
  signatures: []
};