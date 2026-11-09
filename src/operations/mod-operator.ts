import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { box, unbox } from '../interpreter/boxing';
import { isFiniteNumber, numericResultType, truncatedDivMod } from '../utils/decimal';

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
  
  if (!isFiniteNumber(leftValue) || !isFiniteNumber(rightValue) || rightValue === 0) {
    return { value: [], context };
  }
  
  const { remainder } = truncatedDivMod(leftValue, rightValue);
  const type = numericResultType(
    { type: boxedLeft.typeInfo?.type, value: leftValue },
    { type: boxedRight.typeInfo?.type, value: rightValue }
  );
  
  return { value: [box(remainder, { type, singleton: true })], context };
};

export const modOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: 'mod',
  name: 'mod',
  category: ['arithmetic'],
  precedence: PRECEDENCE.MULTIPLICATIVE,
  associativity: 'left',
  description: 'Computes the remainder of the truncated division of its arguments (sign of the dividend). Supported for Integer, Long and Decimal; the result has the type of the operands after implicit conversion. Division by zero returns empty.',
  examples: ['5 mod 2', '5.5 mod 0.7', '-5.5 mod 2', '5 mod 0'],
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