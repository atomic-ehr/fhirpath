import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: FunctionEvaluator = (input, context, args, evaluator) => {
  // abs() takes no arguments
  if (args.length !== 0) {
    throw new Error('abs() takes no arguments');
  }

  // If input is empty, return empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input has multiple items, error
  if (input.length > 1) {
    throw new Error('abs() can only be applied to a single item');
  }

  const boxedValue = input[0];
  if (!boxedValue) return { value: [], context };
  const value = unbox(boxedValue);

  // Handle different types
  if (typeof value === 'number') {
    const result = Math.abs(value);
    const typeInfo = Number.isInteger(result) ? 
      { type: 'Integer' as const, singleton: true } : 
      { type: 'Decimal' as const, singleton: true };
    return { value: [box(result, typeInfo)], context };
  }

  // Handle Quantity type
  if (value && typeof value === 'object' && 'value' in value && 'unit' in value) {
    const result = {
      value: Math.abs(value.value),
      unit: value.unit,
      ...(value._ucumQuantity && { _ucumQuantity: { ...value._ucumQuantity, value: Math.abs(value._ucumQuantity.value) } })
    };
    return { 
      value: [box(result, { type: 'Quantity', singleton: true })], 
      context 
    };
  }

  throw new Error(`Cannot apply abs() to ${typeof value}`);
};

export const absFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'abs',
  category: ['math'],
  description: 'Returns the absolute value of the input. When taking the absolute value of a quantity, the unit is unchanged.',
  examples: [
    '(-5).abs()',
    '(-5.5).abs()',
    "(-5.5 'mg').abs()"
  ],
  signature: {
    input: { type: 'Any', singleton: true },
    parameters: [],
    result: { type: 'Any', singleton: true }
  },
  evaluate
};