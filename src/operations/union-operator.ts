import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { box, unbox } from '../boxing';
import { evaluate as equalsEvaluate } from './equal-operator';

// Note: The union operator is special and is typically handled directly in the interpreter
// because it needs to preserve the original context for both operands
export const evaluate: OperationEvaluator = async (input, context, left, right) => {
  // '|' deduplicates using equals (=) semantics
  const result: any[] = [];
  const isDup = async (candidate: any): Promise<boolean> => {
    for (const existing of result) {
      const eq = await equalsEvaluate(input, context, [existing], [candidate]);
      const v = eq.value[0];
      if (v && typeof v.value === 'boolean' && v.value === true) {
        return true;
      }
    }
    return false;
  };
  for (const item of left) {
    if (!(await isDup(item))) {
      result.push(item);
    }
  }
  for (const item of right) {
    if (!(await isDup(item))) {
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
  description: 'Merges two collections into a single collection, eliminating duplicates using equals (=) semantics. Order is not guaranteed.',
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
