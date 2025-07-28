import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const equalOperator: OperatorDefinition = {
  symbol: '=',
  tokenType: 0,
  name: 'equal',
  category: ['equality'],
  precedence: PRECEDENCE.EQUALITY,
  associativity: 'left',
  description: 'Equality operator',
  examples: ['name = "John"'],
  signatures: []
};

export const notEqualOperator: OperatorDefinition = {
  symbol: '!=',
  tokenType: 0,
  name: 'notEqual',
  category: ['equality'],
  precedence: PRECEDENCE.EQUALITY,
  associativity: 'left',
  description: 'Not equal operator',
  examples: ['name != "John"'],
  signatures: []
};

export const equivalentOperator: OperatorDefinition = {
  symbol: '~',
  tokenType: 0,
  name: 'equivalent',
  category: ['equality'],
  precedence: PRECEDENCE.EQUALITY,
  associativity: 'left',
  description: 'Equivalence operator',
  examples: ['value ~ other'],
  signatures: []
};

export const notEquivalentOperator: OperatorDefinition = {
  symbol: '!~',
  tokenType: 0,
  name: 'notEquivalent',
  category: ['equality'],
  precedence: PRECEDENCE.EQUALITY,
  associativity: 'left',
  description: 'Not equivalent operator',
  examples: ['value !~ other'],
  signatures: []
};