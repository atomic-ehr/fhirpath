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
  
  const { quotient } = truncatedDivMod(leftValue, rightValue);
  const type = numericResultType(
    { type: boxedLeft.typeInfo?.type, value: leftValue },
    { type: boxedRight.typeInfo?.type, value: rightValue }
  );
  
  return { value: [box(quotient, { type, singleton: true })], context };
};

export const divOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: 'div',
  name: 'div',
  category: ['arithmetic'],
  precedence: PRECEDENCE.MULTIPLICATIVE,
  associativity: 'left',
  description: 'Performs truncated division of the left operand by the right operand (rounding toward zero), ignoring any remainder. Supported for Integer, Long and Decimal; the result has the type of the operands after implicit conversion. Division by zero returns empty.',
  examples: ['5 div 2', '5.5 div 0.7', '-5.5 div 2', '10 div 3', '5 div 0'],
  signatures: [
    {
      name: 'integer-div',
      left: { type: 'Integer', singleton: true },
      right: { type: 'Integer', singleton: true },
      result: { type: 'Integer', singleton: true },
    },
    {
      name: 'decimal-div',
      left: { type: 'Decimal', singleton: true },
      right: { type: 'Decimal', singleton: true },
      result: { type: 'Decimal', singleton: true },
    }
  ],
  evaluate
};