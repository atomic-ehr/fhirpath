import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const plusOperator: OperatorDefinition = {
  symbol: '+',
  tokenType: 0, // Will be set by lexer
  name: 'plus',
  category: ['arithmetic'],
  precedence: PRECEDENCE.ADDITIVE,
  associativity: 'left',
  description: 'Addition operator',
  examples: ['5 + 3', 'name + " suffix"'],
  signatures: []
};