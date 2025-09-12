import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../interpreter/boxing';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // log() takes exactly one argument (base)
  if (args.length !== 1) {
    throw Errors.wrongArgumentCount('log', 1, args.length);
  }

  // If input is empty, return empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input has multiple items, error
  if (input.length > 1) {
    throw Errors.singletonRequired('log', input.length);
  }

  const boxedNumber = input[0];
  if (!boxedNumber) {
    return { value: [], context };
  }
  
  const number = unbox(boxedNumber);

  // Number must be a number
  if (typeof number !== 'number') {
    throw Errors.invalidOperandType('log', `${typeof number}`);
  }

  // Evaluate base
  const baseResult = await evaluator(args[0]!, input, context);
  if (baseResult.value.length === 0) {
    return { value: [], context };
  }
  if (baseResult.value.length > 1) {
    throw Errors.invalidOperation('log base must be a single value');
  }

  const boxedBase = baseResult.value[0];
  if (!boxedBase) {
    return { value: [], context };
  }
  
  const base = unbox(boxedBase);
  if (typeof base !== 'number') {
    throw Errors.invalidOperation('log base must be a number');
  }

  // Check for invalid inputs
  if (number <= 0 || base <= 0 || base === 1) {
    // Logarithm undefined for non-positive numbers or base 1
    return { value: [], context };
  }

  // Calculate logarithm using change of base formula: log_b(x) = ln(x) / ln(b)
  const result = Math.log(number) / Math.log(base);

  // Check if result is valid (not NaN or Infinity)
  if (!isFinite(result)) {
    return { value: [], context };
  }

  // Always return as Decimal per spec
  return { value: [box(result, { type: 'Decimal', singleton: true })], context };
};

export const logFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'log',
  category: ['math'],
  description: 'Returns the logarithm base base of the input number. When used with Integers, the arguments will be implicitly converted to Decimal.',
  examples: [
    '16.log(2)',
    '100.0.log(10.0)'
  ],
  signatures: [
    {
      name: 'log-integer',
      input: { type: 'Integer', singleton: true },
      parameters: [
        { name: 'base', type: { type: 'Integer', singleton: true }, optional: false }
      ],
      result: { type: 'Decimal', singleton: true }
    },
    {
      name: 'log-decimal',
      input: { type: 'Decimal', singleton: true },
      parameters: [
        { name: 'base', type: { type: 'Decimal', singleton: true }, optional: false }
      ],
      result: { type: 'Decimal', singleton: true }
    },
    {
      name: 'log-integer-decimal',
      input: { type: 'Integer', singleton: true },
      parameters: [
        { name: 'base', type: { type: 'Decimal', singleton: true }, optional: false }
      ],
      result: { type: 'Decimal', singleton: true }
    },
    {
      name: 'log-decimal-integer',
      input: { type: 'Decimal', singleton: true },
      parameters: [
        { name: 'base', type: { type: 'Integer', singleton: true }, optional: false }
      ],
      result: { type: 'Decimal', singleton: true }
    }
  ],
  evaluate
};