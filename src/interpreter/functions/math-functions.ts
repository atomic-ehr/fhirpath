import { FunctionRegistry } from './registry';
import { CollectionUtils } from '../types';

// Mathematical functions

// Standalone function implementations
export const absFn = (interpreter: any, context: any, input: any[]) => {
  if (input.length === 0) {
    return { value: [], context };
  }
  const num = CollectionUtils.toSingleton(input);
  return { value: [Math.abs(num)], context };
};


export const roundFn = (interpreter: any, context: any, input: any[], precision?: number) => {
  if (input.length === 0) {
    return { value: [], context };
  }
  const num = CollectionUtils.toSingleton(input);
  
  if (precision === undefined) {
    return { value: [Math.round(num)], context };
  }
  
  const factor = Math.pow(10, precision);
  return { value: [Math.round(num * factor) / factor], context };
};

export const sqrtFn = (interpreter: any, context: any, input: any[]) => {
  if (input.length === 0) {
    return { value: [], context };
  }
  const num = CollectionUtils.toSingleton(input);
  
  if (num < 0) {
    return { value: [], context }; // FHIRPath returns empty for invalid operations
  }
  
  return { value: [Math.sqrt(num)], context };
};


// Register functions with new signature

// abs() - absolute value
FunctionRegistry.register({
  name: 'abs',
  inputType: 'decimal',
  propagateEmptyInput: true,
  evaluate: absFn
});


// round([precision]) - round to precision
FunctionRegistry.register({
  name: 'round',
  inputType: 'decimal',
  propagateEmptyInput: true,
  arguments: [{
    name: 'precision',
    type: 'integer',
    optional: true
  }],
  evaluate: roundFn
});

// sqrt() - square root
FunctionRegistry.register({
  name: 'sqrt',
  inputType: 'decimal',
  propagateEmptyInput: true,
  evaluate: sqrtFn
});

