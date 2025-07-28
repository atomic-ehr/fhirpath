import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const lessThanOperator: OperatorDefinition = {
  symbol: '<',
  name: 'less-than',
  category: ['comparison'],
  precedence: PRECEDENCE.COMPARISON,
  associativity: 'left',
  description: 'Less than comparison',
  examples: ['5 < 10', 'age < 18'],
  signatures: [{
    name: 'less-than',
    left: { type: 'Any', singleton: true },
    right: { type: 'Any', singleton: true },
    result: { type: 'Boolean', singleton: true },
  }]
};