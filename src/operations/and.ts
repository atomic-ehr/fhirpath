import { TokenType } from '../lexer';
import type { BinaryOperator } from '../registry';

export const andOperator: BinaryOperator = {
  symbol: 'and',
  name: 'and',
  tokenType: TokenType.AND,
  category: ['logical'],
  precedence: 30,
  associativity: 'left',
  description: 'Logical AND operator',
  examples: ['true and false', 'Patient.active and Patient.gender = "male"'],
  signatures: [{
    name: 'logical-and',
    left: { type: 'Boolean', singleton: true },
    right: { type: 'Boolean', singleton: true },
    result: { type: 'Boolean', singleton: true },
  }]
};