import { TokenType } from '../lexer';
import type { BinaryOperator } from '../registry';

export const lessThanOperator: BinaryOperator = {
  symbol: '<',
  name: 'less-than',
  tokenType: TokenType.LT,
  category: ['comparison'],
  precedence: 50,
  associativity: 'left',
  description: 'Less than comparison',
  examples: ['5 < 10', 'age < 18'],
  signatures: [{
    name: 'less-than',
    left: { type: 'Any', singleton: true },
    right: { type: 'Any', singleton: true },
    result: { type: 'Boolean', singleton: true },
  }]
};