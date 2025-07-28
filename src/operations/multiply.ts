import { TokenType } from '../lexer';
import type { BinaryOperator } from '../registry';

export const multiplyOperator: BinaryOperator = {
  symbol: '*',
  name: 'multiply',
  tokenType: TokenType.MULTIPLY,
  category: ['arithmetic'],
  precedence: 80,
  associativity: 'left',
  description: 'Multiplication operator',
  examples: ['2 * 3', '5.5 * 2'],
  signatures: [{
    name: 'numeric-multiply',
    left: { type: 'Decimal', singleton: true },
    right: { type: 'Decimal', singleton: true },
    result: { type: 'Decimal', singleton: true },
  }]
};