import { FunctionRegistry } from './registry';
import { CollectionUtils, EvaluationError } from '../types';
import { nonNegativeInteger } from './validators';

// Collection subsetting functions

// Standalone function implementations
export const firstFn = (interpreter: any, context: any, input: any[]) => {
  return { value: input.length > 0 ? [input[0]] : [], context };
};

export const lastFn = (interpreter: any, context: any, input: any[]) => {
  return { value: input.length > 0 ? [input[input.length - 1]] : [], context };
};

export const tailFn = (interpreter: any, context: any, input: any[]) => {
  return { value: input.slice(1), context };
};

export const skipFn = (interpreter: any, context: any, input: any[], count: number) => {
  return { value: input.slice(count), context };
};

export const takeFn = (interpreter: any, context: any, input: any[], count: number) => {
  return { value: input.slice(0, count), context };
};

export const singleFn = (interpreter: any, context: any, input: any[]) => {
  if (input.length === 0) {
    return { value: [], context };
  }
  if (input.length > 1) {
    throw new EvaluationError(`Expected single item but got ${input.length}`);
  }
  return { value: input, context };
};

// Register functions with new signature

// first() - returns first item
FunctionRegistry.register({
  name: 'first',
  evaluate: firstFn
});

// last() - returns last item
FunctionRegistry.register({
  name: 'last',
  evaluate: lastFn
});

// tail() - returns all but first
FunctionRegistry.register({
  name: 'tail',
  evaluate: tailFn
});

// skip(n) - skips first n items
FunctionRegistry.register({
  name: 'skip',
  arguments: [{
    name: 'count',
    type: 'integer',
    validator: nonNegativeInteger
  }],
  evaluate: skipFn
});

// take(n) - takes first n items
FunctionRegistry.register({
  name: 'take',
  arguments: [{
    name: 'count',
    type: 'integer',
    validator: nonNegativeInteger
  }],
  evaluate: takeFn
});

// single() - returns single item or errors
FunctionRegistry.register({
  name: 'single',
  evaluate: singleFn
});