import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const equalOperator: OperatorDefinition = {
  symbol: '=',
  name: 'equal',
  category: ['equality'],
  precedence: PRECEDENCE.EQUALITY,
  associativity: 'left',
  description: 'Equality operator',
  examples: ['name = "John"','Patient.name = "John"', '5 = 5'],
  signatures: [{
    name: 'equal',
    left: { type: 'Any', singleton: true },
    right: { type: 'Any', singleton: true },
    result: { type: 'Boolean', singleton: true },
  }]
};