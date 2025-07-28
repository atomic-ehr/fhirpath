import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const impliesOperator: OperatorDefinition = {
  symbol: 'implies',
  name: 'implies',
  category: ['logical'],
  precedence: PRECEDENCE.IMPLIES,
  associativity: 'right',
  description: 'Logical implication operator',
  examples: ['condition implies result'],
  signatures: []
};