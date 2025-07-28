import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../interpreter';

export const evaluate: OperationEvaluator = (input, context, left, right) => {
  // Note: 'is' operator requires special handling for type checking
  // Right operand should be a type identifier
  // For now, implementing basic type checking
  if (left.length === 0) {
    return { value: [false], context };
  }
  
  // TODO: Implement proper FHIRPath type checking
  // This is a simplified version
  const item = left[0];
  const typeName = right[0]; // Should be a type name like 'String', 'Integer', etc.
  
  switch (typeName) {
    case 'String':
      return { value: [typeof item === 'string'], context };
    case 'Boolean':
      return { value: [typeof item === 'boolean'], context };
    case 'Integer':
      return { value: [Number.isInteger(item)], context };
    case 'Decimal':
      return { value: [typeof item === 'number'], context };
    default:
      return { value: [false], context };
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