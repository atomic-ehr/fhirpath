import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const unionOperator: OperatorDefinition = {
  symbol: '|',
  name: 'union',
  category: ['collection'],
  precedence: PRECEDENCE.PIPE,
  associativity: 'left',
  description: 'Union operator',
  examples: ['name | alias'],
  signatures: []
};