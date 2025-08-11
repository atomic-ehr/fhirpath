import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import type { QuantityValue } from '../quantity-value';
import { box, unbox } from '../boxing';

export const evaluate: OperationEvaluator = async (input, context, operand) => {
  // Unary minus negates each boxed value
  const results: any[] = [];
  
  for (const boxedValue of operand) {
    const v = unbox(boxedValue);
    
    if (v && typeof v === 'object' && 'unit' in v) {
      // Handle quantity
      const q = v as QuantityValue;
      results.push(box({ value: -q.value, unit: q.unit }, { type: 'Quantity', singleton: true }));
    } else if (typeof v === 'number') {
      const result = -v;
      const typeInfo = Number.isInteger(result) ? 
        { type: 'Integer' as const, singleton: true } : 
        { type: 'Decimal' as const, singleton: true };
      results.push(box(result, typeInfo));
    }
    // For non-numeric values, skip (return empty)
  }
  
  return { value: results, context };
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