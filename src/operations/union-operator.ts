import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { box, unbox } from '../boxing';

// Note: The union operator is special and is typically handled directly in the interpreter
// because it needs to preserve the original context for both operands
export const evaluate: OperationEvaluator = (input, context, left, right) => {
  // Union merges collections and eliminates duplicates using equals (=) operator
  const result: any[] = [];
  const seen = new Set<any>();
  
  // Add items from left collection
  for (const item of left) {
    let isDuplicate = false;
    for (const existing of result) {
      // Use equals operator semantics for duplicate detection
      if (existing === item) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) {
      result.push(item);
    }
  }
  
  // Add items from right collection if not already present
  for (const item of right) {
    let isDuplicate = false;
    for (const existing of result) {
      // Use equals operator semantics for duplicate detection
      if (existing === item) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) {
      result.push(item);
    }
  }
  
  return { value: result, context };
};

export const unionOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '|',
  name: 'union',
  category: ['collection'],
  precedence: PRECEDENCE.PIPE,
  associativity: 'left',
  description: 'Merges two collections into a single collection, eliminating any duplicate values using the equals (=) operator. There is no expectation of order in the resulting collection',
  examples: [
    'name.given | name.family',
    'Patient.identifier | Patient.contact.identifier',
    '(1 | 2 | 3) | (2 | 3 | 4)',
    'name.select(use | given)'
  ],
  signatures: [
    {
      name: 'union',
      left: { type: 'Any', singleton: false },
      right: { type: 'Any', singleton: false },
      result: 'leftType' as any,
    }
  ],
  evaluate
};