import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  if (left.length === 0 || right.length === 0) {
    return { value: [], context };
  }
  return { value: [left[0] < right[0]], context };
};

export const lessOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '<',
  name: 'less',
  category: ['comparison'],
  precedence: PRECEDENCE.COMPARISON,
  associativity: 'left',
  description: 'Returns true if the first operand is strictly less than the second. The operands must be of the same type, or convertible to the same type using implicit conversion.',
  examples: ['age < 18', '10 < 5', '@2018-03-01 < @2018-01-01', '"abc" < "ABC"'],
  signatures: [
    {
      name: 'string-less',
      left: { type: 'String', singleton: true },
      right: { type: 'String', singleton: true },
      result: { type: 'Boolean', singleton: true },
    },
    {
      name: 'integer-less',
      left: { type: 'Integer', singleton: true },
      right: { type: 'Integer', singleton: true },
      result: { type: 'Boolean', singleton: true },
    },
    {
      name: 'decimal-less',
      left: { type: 'Decimal', singleton: true },
      right: { type: 'Decimal', singleton: true },
      result: { type: 'Boolean', singleton: true },
    },
    {
      name: 'quantity-less',
      left: { type: 'Quantity', singleton: true },
      right: { type: 'Quantity', singleton: true },
      result: { type: 'Boolean', singleton: true },
    },
    {
      name: 'date-less',
      left: { type: 'Date', singleton: true },
      right: { type: 'Date', singleton: true },
      result: { type: 'Boolean', singleton: true },
    },
    {
      name: 'datetime-less',
      left: { type: 'DateTime', singleton: true },
      right: { type: 'DateTime', singleton: true },
      result: { type: 'Boolean', singleton: true },
    },
    {
      name: 'time-less',
      left: { type: 'Time', singleton: true },
      right: { type: 'Time', singleton: true },
      result: { type: 'Boolean', singleton: true },
    }
  ],
  evaluate
};