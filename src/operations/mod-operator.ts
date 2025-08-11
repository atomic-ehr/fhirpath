import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: OperationEvaluator = async (input, context, left, right) => {
  if (left.length === 0 || right.length === 0) {
    return { value: [], context };
  }
  
  const boxedLeft = left[0];
  const boxedRight = right[0];
  if (!boxedLeft || !boxedRight) {
    return { value: [], context };
  }
  
  const leftValue = unbox(boxedLeft);
  const rightValue = unbox(boxedRight);
  
  if (rightValue === 0) {
    return { value: [], context };
  }
  
  const result = (leftValue as any) % (rightValue as any);
  
  // Determine result type based on input types
  const resultType = Number.isInteger(leftValue) && Number.isInteger(rightValue) ? 'Integer' : 'Decimal';
  
  return { value: [box(result, { type: resultType, singleton: true })], context };
};

export const modOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: 'mod',
  name: 'mod',
  category: ['arithmetic'],
  precedence: PRECEDENCE.MULTIPLICATIVE,
  associativity: 'left',
  description: 'Computes the remainder of the truncated division of its arguments. Supported for Integer and Decimal types. Division by zero returns empty.',
  examples: ['5 mod 2', '5.5 mod 0.7', '5 mod 0'],
  signatures: [
    {
      name: 'integer-mod',
      left: { type: 'Integer', singleton: true },
      right: { type: 'Integer', singleton: true },
      result: { type: 'Integer', singleton: true },
    },
    {
      name: 'decimal-mod',
      left: { type: 'Decimal', singleton: true },
      right: { type: 'Decimal', singleton: true },
      result: { type: 'Decimal', singleton: true },
    }
  ],
  evaluate
};