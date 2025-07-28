import { TokenType } from '../lexer';
import type { BinaryOperator } from '../registry';

export const minusOperator: BinaryOperator = {
  symbol: '-',
  name: 'minus',
  tokenType: TokenType.MINUS,
  category: ['arithmetic'],
  precedence: 70,
  associativity: 'left',
  description: 'Subtraction operator',
  examples: ['5 - 3', '10.5 - 2.5'],
  signatures: [{
    name: 'numeric-minus',
    left: { type: 'Decimal', singleton: true },
    right: { type: 'Decimal', singleton: true },
    result: { type: 'Decimal', singleton: true },
  }]
};