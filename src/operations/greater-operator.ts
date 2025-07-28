import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  if (left.length === 0 || right.length === 0) {
    return { value: [], context };
  }
  return { value: [left[0] > right[0]], context };
};

export const greaterOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '>',
  name: 'greater',
  category: ['comparison'],
  precedence: PRECEDENCE.COMPARISON,
  associativity: 'left',
  description: 'Returns true if the first operand is strictly greater than the second. The operands must be of the same type, or convertible to the same type using implicit conversion',
  examples: ['age > 18', '10 > 5', '"abc" > "ABC"', '@2018-03-01 > @2018-01-01'],
  signatures: [
    {
      name: 'string-greater',
      left: { type: 'String', singleton: true },
      right: { type: 'String', singleton: true },
      result: { type: 'Boolean', singleton: true },
    },
    {
      name: 'integer-greater',
      left: { type: 'Integer', singleton: true },
      right: { type: 'Integer', singleton: true },
      result: { type: 'Boolean', singleton: true },
    },
    {
      name: 'decimal-greater',
      left: { type: 'Decimal', singleton: true },
      right: { type: 'Decimal', singleton: true },
      result: { type: 'Boolean', singleton: true },
    },
    {
      name: 'quantity-greater',
      left: { type: 'Quantity', singleton: true },
      right: { type: 'Quantity', singleton: true },
      result: { type: 'Boolean', singleton: true },
    },
    {
      name: 'date-greater',
      left: { type: 'Date', singleton: true },
      right: { type: 'Date', singleton: true },
      result: { type: 'Boolean', singleton: true },
    },
    {
      name: 'datetime-greater',
      left: { type: 'DateTime', singleton: true },
      right: { type: 'DateTime', singleton: true },
      result: { type: 'Boolean', singleton: true },
    },
    {
      name: 'time-greater',
      left: { type: 'Time', singleton: true },
      right: { type: 'Time', singleton: true },
      result: { type: 'Boolean', singleton: true },
    }
  ],
  evaluate
};