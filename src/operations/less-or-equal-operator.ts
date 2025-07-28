import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const lessOrEqualOperator: OperatorDefinition = {
  symbol: '<=',
  name: 'lessOrEqual',
  category: ['comparison'],
  precedence: PRECEDENCE.COMPARISON,
  associativity: 'left',
  description: 'Less than or equal operator',
  examples: ['age <= 18'],
  signatures: []
};