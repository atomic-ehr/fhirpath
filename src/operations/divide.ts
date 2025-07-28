import { TokenType } from '../lexer';
import type { BinaryOperator } from '../registry';

export const divideOperator: BinaryOperator = {
  symbol: '/',
  name: 'divide',
  tokenType: TokenType.DIVIDE,
  category: ['arithmetic'],
  precedence: 80,
  associativity: 'left',
  description: 'Division operator',
  examples: ['10 / 2', '7.5 / 1.5'],
  signatures: [{
    name: 'numeric-divide',
    left: { type: 'Decimal', singleton: true },
    right: { type: 'Decimal', singleton: true },
    result: { type: 'Decimal', singleton: true },
  }]
};