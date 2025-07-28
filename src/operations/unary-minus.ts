import { TokenType } from '../lexer';
import type { UnaryOperator } from '../registry';

export const unaryMinusOperator: UnaryOperator = {
  symbol: '-',
  name: 'unary-minus',
  tokenType: TokenType.MINUS,
  category: ['arithmetic'],
  precedence: 80, // Higher than binary operators
  description: 'Unary negation',
  examples: ['-5', '-(3 + 2)'],
  signature: {
    operand: { type: 'Decimal', singleton: true },
    result: { type: 'Decimal', singleton: true },
  }
};