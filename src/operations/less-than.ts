import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { box, unbox } from '../interpreter/boxing';
import { compare } from './comparison';

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
  
  // Use the unified compare function which handles all types including FHIR Quantities
  const comparisonResult = compare(leftValue, rightValue);
  
  if (comparisonResult.kind === 'incomparable') {
    return { value: [], context };
  }
  
  return { value: [box(comparisonResult.kind === 'less', { type: 'Boolean', singleton: true })], context };
};

export const lessThanOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '<',
  name: 'less-than',
  category: ['comparison'],
  precedence: PRECEDENCE.COMPARISON,
  associativity: 'left',
  description: 'Less than comparison',
  examples: ['5 < 10', 'age < 18'],
  signatures: [{
    name: 'less-than',
    left: { type: 'Any', singleton: true },
    right: { type: 'Any', singleton: true },
    result: { type: 'Boolean', singleton: true },
  }],
  evaluate
};