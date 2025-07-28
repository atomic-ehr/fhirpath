import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const andOperator: OperatorDefinition = {
  symbol: 'and',
  tokenType: 0,
  name: 'and',
  category: ['logical'],
  precedence: PRECEDENCE.AND,
  associativity: 'left',
  description: 'Logical AND operator',
  examples: ['active and verified'],
  signatures: []
};

export const orOperator: OperatorDefinition = {
  symbol: 'or',
  tokenType: 0,
  name: 'or',
  category: ['logical'],
  precedence: PRECEDENCE.OR,
  associativity: 'left',
  description: 'Logical OR operator',
  examples: ['active or pending'],
  signatures: []
};

export const xorOperator: OperatorDefinition = {
  symbol: 'xor',
  tokenType: 0,
  name: 'xor',
  category: ['logical'],
  precedence: PRECEDENCE.XOR,
  associativity: 'left',
  description: 'Logical XOR operator',
  examples: ['a xor b'],
  signatures: []
};

export const impliesOperator: OperatorDefinition = {
  symbol: 'implies',
  tokenType: 0,
  name: 'implies',
  category: ['logical'],
  precedence: PRECEDENCE.IMPLIES,
  associativity: 'right',
  description: 'Logical implication operator',
  examples: ['condition implies result'],
  signatures: []
};

export const notOperator: OperatorDefinition = {
  symbol: 'not',
  tokenType: 0,
  name: 'not',
  category: ['logical'],
  precedence: PRECEDENCE.UNARY,
  associativity: 'right',
  description: 'Logical NOT operator',
  examples: ['not active'],
  signatures: []
};