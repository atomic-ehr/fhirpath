import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const orOperator: OperatorDefinition = {
  symbol: 'or',
  tokenType: 0,
  name: 'or',
  category: ['logical'],
  precedence: PRECEDENCE.OR,
  associativity: 'left',
  description: 'Logical OR operator',
  examples: ['active or pending'],
  signatures: []
};