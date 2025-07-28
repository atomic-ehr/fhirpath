import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';

export const unionOperator: OperatorDefinition = {
  symbol: '|',
  tokenType: 0,
  name: 'union',
  category: ['collection'],
  precedence: PRECEDENCE.PIPE,
  associativity: 'left',
  description: 'Union operator',
  examples: ['name | alias'],
  signatures: []
};

export const combineOperator: OperatorDefinition = {
  symbol: '&',
  tokenType: 0,
  name: 'combine',
  category: ['string'],
  precedence: PRECEDENCE.ADDITIVE,
  associativity: 'left',
  description: 'String concatenation operator',
  examples: ['first & " " & last'],
  signatures: []
};

export const dotOperator: OperatorDefinition = {
  symbol: '.',
  tokenType: 0,
  name: 'dot',
  category: ['navigation'],
  precedence: PRECEDENCE.DOT,
  associativity: 'left',
  description: 'Navigation operator',
  examples: ['Patient.name.given'],
  signatures: []
};