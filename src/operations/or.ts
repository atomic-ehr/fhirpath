import { TokenType } from '../lexer';
import type { BinaryOperator } from '../registry';

export const orOperator: BinaryOperator = {
  symbol: 'or',
  name: 'or',
  tokenType: TokenType.OR,
  category: ['logical'],
  precedence: 20,
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