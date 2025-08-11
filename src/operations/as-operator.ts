import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: OperationEvaluator = async (input, context, left, right) => {
  // 'as' operator performs type casting/filtering
  // Returns items that match the type, empty if no match
  if (left.length === 0) {
    return { value: [], context };
  }
  
  // TODO: Implement proper FHIRPath type casting
  // For now, just return the value as-is if it matches the type
  const results: any[] = [];
  const typeName = right[0]; // Should be a type name
  
  for (const item of left) {
    let matches = false;
    switch (typeName) {
      case 'String':
        matches = typeof item === 'string';
        break;
      case 'Boolean':
        matches = typeof item === 'boolean';
        break;
      case 'Integer':
        matches = Number.isInteger(item);
        break;
      case 'Decimal':
        matches = typeof item === 'number';
        break;
    }
    if (matches) {
      results.push(item);
    }
  }
  
  return { value: results, context };
};

export const asOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: 'as',
  name: 'as',
  category: ['type'],
  precedence: PRECEDENCE.AS_IS,
  associativity: 'left',
  description: 'Type cast operator',
  examples: ['value as String'],
  signatures: [],
  evaluate
};