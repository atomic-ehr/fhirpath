import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const dotOperator: OperatorDefinition = {
  symbol: '.',
  name: 'dot',
  category: ['navigation'],
  precedence: PRECEDENCE.DOT,
  associativity: 'left',
  description: 'Navigation operator',
  examples: ['Patient.name.given'],
  signatures: []
};