import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';

// Note: 'not' is a unary operator, so it only uses the first argument
export const evaluate: OperationEvaluator = (input, context, operand) => {
  if (operand.length === 0) {
    return { value: [], context };  // not({}) = {}
  }
  return { value: [!operand[0]], context };
};

export const notOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: 'not',
  name: 'not',
  category: ['logical'],
  precedence: PRECEDENCE.UNARY,
  associativity: 'right',
  description: 'Logical NOT operator',
  examples: ['not active'],
  signatures: [],
  evaluate
};