import { TokenType } from '../lexer';
import type { BinaryOperator } from '../registry';

export const equalOperator: BinaryOperator = {
  symbol: '=',
  name: 'equal',
  tokenType: TokenType.EQ,
  category: ['comparison'],
  precedence: 40,
  associativity: 'left',
  description: 'Equality operator',
  examples: ['Patient.name = "John"', '5 = 5'],
  signatures: [{
    name: 'equal',
    left: { type: 'Any', singleton: true },
    right: { type: 'Any', singleton: true },
    result: { type: 'Boolean', singleton: true },
  }]
};