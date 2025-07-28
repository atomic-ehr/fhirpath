import { TokenType } from '../lexer';
import type { BinaryOperator } from '../registry';

export const plusOperator: BinaryOperator = {
  symbol: '+',
  name: 'plus',
  tokenType: TokenType.PLUS,
  category: ['arithmetic'],
  precedence: 70,
  associativity: 'left',
  description: 'Addition operator',
  examples: ['2 + 3', '"Hello" + " " + "World"'],
  signatures: [
    {
      name: 'numeric-plus',
      left: { type: 'Decimal', singleton: true },
      right: { type: 'Decimal', singleton: true },
      result: { type: 'Decimal', singleton: true },
    },
    {
      name: 'string-plus',
      left: { type: 'String', singleton: true },
      right: { type: 'String', singleton: true },
      result: { type: 'String', singleton: true },
    }
  ],
};