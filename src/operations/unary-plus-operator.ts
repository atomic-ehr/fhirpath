import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../interpreter';

export const evaluate: OperationEvaluator = (input, context, operand) => {
  // Unary plus returns the operand as-is
  return { value: operand, context };
};

export const unaryPlusOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '+',
  name: 'unaryPlus',
  category: ['arithmetic'],
  precedence: PRECEDENCE.UNARY,
  associativity: 'right',
  description: 'Unary plus operator',
  examples: ['+5'],
  signatures: [],
  evaluate
};