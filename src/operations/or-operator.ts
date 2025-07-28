import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const orOperator: OperatorDefinition = {
  symbol: 'or',
  name: 'or',
  category: ['logical'],
  precedence: PRECEDENCE.OR,
  associativity: 'left',
  description: 'Logical OR operator',
  examples: ['true or false', 'Patient.active or Patient.gender = "female"'],
  signatures: [{
    name: 'logical-or',
    left: { type: 'Boolean', singleton: true },
    right: { type: 'Boolean', singleton: true },
    result: { type: 'Boolean', singleton: true },
  }]
};