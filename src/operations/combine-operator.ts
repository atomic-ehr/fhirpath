import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const combineOperator: OperatorDefinition = {
  symbol: '&',
  name: 'combine',
  category: ['string'],
  precedence: PRECEDENCE.ADDITIVE,
  associativity: 'left',
  description: 'String concatenation operator',
  examples: ['first & " " & last'],
  signatures: []
};