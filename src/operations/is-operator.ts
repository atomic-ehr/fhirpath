import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  // Note: 'is' operator requires special handling for type checking
  // Right operand should be a type identifier
  // For now, implementing basic type checking
  if (left.length === 0) {
    return { value: [box(false, { type: 'Boolean', singleton: true })], context };
  }
  
  // TODO: Implement proper FHIRPath type checking
  // This is a simplified version
  const item = left[0];
  const typeName = right[0]; // Should be a type name like 'String', 'Integer', etc.
  
  switch (typeName) {
    case 'String':
      return { value: [box(typeof item === 'string', { type: 'Boolean', singleton: true })], context };
    case 'Boolean':
      return { value: [box(typeof item === 'boolean', { type: 'Boolean', singleton: true })], context };
    case 'Integer':
      return { value: [box(Number.isInteger(item), { type: 'Any', singleton: true })], context };
    case 'Decimal':
      return { value: [box(typeof item === 'number', { type: 'Boolean', singleton: true })], context };
    default:
      return { value: [box(false, { type: 'Boolean', singleton: true })], context };
  }
};

export const isOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: 'is',
  name: 'is',
  category: ['type'],
  precedence: PRECEDENCE.AS_IS,
  associativity: 'left',
  description: 'Type test operator',
  examples: ['value is String'],
  signatures: [],
  evaluate
};