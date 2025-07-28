import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';

// Note: The union operator is special and is typically handled directly in the interpreter
// because it needs to preserve the original context for both operands
export const evaluate: OperationEvaluator = (input, context, left, right) => {
  // Union simply concatenates the two collections
  return { value: [...left, ...right], context };
};

export const unionOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '|',
  name: 'union',
  category: ['collection'],
  precedence: PRECEDENCE.PIPE,
  associativity: 'left',
  description: 'Union operator',
  examples: ['name | alias'],
  signatures: [],
  evaluate
};