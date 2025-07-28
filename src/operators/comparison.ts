import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const lessOperator: OperatorDefinition = {
  symbol: '<',
  tokenType: 0,
  name: 'less',
  category: ['comparison'],
  precedence: PRECEDENCE.COMPARISON,
  associativity: 'left',
  description: 'Less than operator',
  examples: ['age < 18'],
  signatures: []
};

export const greaterOperator: OperatorDefinition = {
  symbol: '>',
  tokenType: 0,
  name: 'greater',
  category: ['comparison'],
  precedence: PRECEDENCE.COMPARISON,
  associativity: 'left',
  description: 'Greater than operator',
  examples: ['age > 18'],
  signatures: []
};

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

export const greaterOrEqualOperator: OperatorDefinition = {
  symbol: '>=',
  tokenType: 0,
  name: 'greaterOrEqual',
  category: ['comparison'],
  precedence: PRECEDENCE.COMPARISON,
  associativity: 'left',
  description: 'Greater than or equal operator',
  examples: ['age >= 18'],
  signatures: []
};