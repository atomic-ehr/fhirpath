import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../interpreter';

// Note: The dot operator is special and is typically handled directly in the interpreter
// because it needs to evaluate its operands in sequence, not in parallel
export const evaluate: OperationEvaluator = (input, context, left, right) => {
  // This should not be called directly - dot operator needs special handling
  // in the interpreter to properly sequence evaluation
  throw new Error('Dot operator requires special handling in the interpreter');
};

export const dotOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '.',
  name: 'dot',
  category: ['navigation'],
  precedence: PRECEDENCE.DOT,
  associativity: 'left',
  description: 'Navigation operator',
  examples: ['Patient.name.given'],
  signatures: [],
  evaluate
};