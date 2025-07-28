import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  if (left.length === 0 || right.length === 0) {
    return { value: [], context };
  }
  return { value: [left[0] >= right[0]], context };
};

export const greaterOrEqualOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '>=',
  name: 'greaterOrEqual',
  category: ['comparison'],
  precedence: PRECEDENCE.COMPARISON,
  associativity: 'left',
  description: 'Returns true if the first operand is greater than or equal to the second. The operands must be of the same type, or convertible to the same type using implicit conversion. For partial precision dates/times, returns empty if precision differs.',
  examples: [
    '10 >= 5',
    "'abc' >= 'ABC'",
    '10 >= 5.0',
    '@2018-03-01 >= @2018-01-01',
    '@T10:30:00 >= @T10:00:00'
  ],
  signatures: [
    {
      name: 'integer-greaterOrEqual',
      left: { type: 'Integer', singleton: true },
      right: { type: 'Integer', singleton: true },
      result: { type: 'Boolean', singleton: true },
    },
    {
      name: 'decimal-greaterOrEqual',
      left: { type: 'Decimal', singleton: true },
      right: { type: 'Decimal', singleton: true },
      result: { type: 'Boolean', singleton: true },
    },
    {
      name: 'string-greaterOrEqual',
      left: { type: 'String', singleton: true },
      right: { type: 'String', singleton: true },
      result: { type: 'Boolean', singleton: true },
    },
    {
      name: 'date-greaterOrEqual',
      left: { type: 'Date', singleton: true },
      right: { type: 'Date', singleton: true },
      result: { type: 'Boolean', singleton: true },
    },
    {
      name: 'datetime-greaterOrEqual',
      left: { type: 'DateTime', singleton: true },
      right: { type: 'DateTime', singleton: true },
      result: { type: 'Boolean', singleton: true },
    },
    {
      name: 'time-greaterOrEqual',
      left: { type: 'Time', singleton: true },
      right: { type: 'Time', singleton: true },
      result: { type: 'Boolean', singleton: true },
    },
    {
      name: 'quantity-greaterOrEqual',
      left: { type: 'Quantity', singleton: true },
      right: { type: 'Quantity', singleton: true },
      result: { type: 'Boolean', singleton: true },
    }
  ],
  evaluate
};