import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../interpreter';

export const evaluate: OperationEvaluator = (input, context, operand) => {
  // Unary minus negates each value
  return { value: operand.map(v => -v), context };
};

export const unaryMinusOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '-',
  name: 'unaryMinus',
  category: ['arithmetic'],
  precedence: PRECEDENCE.UNARY,
  associativity: 'right',
  description: 'Unary minus operator',
  examples: ['-5'],
  signatures: [],
  evaluate
};