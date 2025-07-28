import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const lessOrEqualOperator: OperatorDefinition = {
  symbol: '<=',
  tokenType: 0,
  name: 'lessOrEqual',
  category: ['comparison'],
  precedence: PRECEDENCE.COMPARISON,
  associativity: 'left',
  description: 'Less than or equal operator',
  examples: ['age <= 18'],
  signatures: []
};