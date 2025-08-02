import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import type { QuantityValue } from '../quantity-value';

export const evaluate: OperationEvaluator = (input, context, operand) => {
  // Unary minus negates each value
  return { 
    value: operand.map(v => {
      if (v && typeof v === 'object' && 'unit' in v) {
        // Handle quantity
        const q = v as QuantityValue;
        return { value: -q.value, unit: q.unit };
      }
      return -v;
    }), 
    context 
  };
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