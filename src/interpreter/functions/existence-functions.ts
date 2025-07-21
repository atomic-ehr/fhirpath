import { FunctionRegistry } from './registry';
import { isTruthy } from '../helpers';
import { ContextManager } from '../context';

// Existence testing functions

// Standalone function implementations
export const emptyFn = (interpreter: any, context: any, input: any[]) => {
  return { value: [input.length === 0], context };
};

export const existsFn = (interpreter: any, context: any, input: any[], criteria?: any) => {
  if (!criteria) {
    // No criteria - just check if input is not empty
    return { value: [input.length > 0], context };
  }
  
  // With criteria - check if any item matches
  for (let i = 0; i < input.length; i++) {
    const item = input[i];
    const iterContext = ContextManager.setIteratorContext(context, item, i);
    const result = interpreter.evaluate(criteria, [item], iterContext);
    
    if (isTruthy(result.value)) {
      return { value: [true], context };
    }
  }
  
  return { value: [false], context };
};

export const countFn = (interpreter: any, context: any, input: any[]) => {
  return { value: [input.length], context };
};

export const allFn = (interpreter: any, context: any, input: any[], criteria?: any) => {
  if (input.length === 0) {
    return { value: [true], context };
  }
  
  if (!criteria) {
    // No criteria - all() returns true only if all items are true
    return { value: [input.every(item => item === true)], context };
  }
  
  // With criteria - check if all items match
  for (let i = 0; i < input.length; i++) {
    const item = input[i];
    const iterContext = ContextManager.setIteratorContext(context, item, i);
    const result = interpreter.evaluate(criteria, [item], iterContext);
    
    if (!isTruthy(result.value)) {
      return { value: [false], context };
    }
  }
  
  return { value: [true], context };
};

export const allTrueFn = (interpreter: any, context: any, input: any[]) => {
  return { value: [input.every(item => item === true)], context };
};

export const anyTrueFn = (interpreter: any, context: any, input: any[]) => {
  return { value: [input.some(item => item === true)], context };
};

export const allFalseFn = (interpreter: any, context: any, input: any[]) => {
  return { value: [input.every(item => item === false)], context };
};

export const anyFalseFn = (interpreter: any, context: any, input: any[]) => {
  return { value: [input.some(item => item === false)], context };
};

export const distinctFn = (interpreter: any, context: any, input: any[]) => {
  const seen = new Set();
  const result: any[] = [];
  
  for (const item of input) {
    const key = JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  
  return { value: result, context };
};

export const isDistinctFn = (interpreter: any, context: any, input: any[]) => {
  const seen = new Set();
  
  for (const item of input) {
    const key = JSON.stringify(item);
    if (seen.has(key)) {
      return { value: [false], context };
    }
    seen.add(key);
  }
  
  return { value: [true], context };
};

// Register functions with new signature

// empty() - tests if collection is empty
FunctionRegistry.register({
  name: 'empty',
  evaluate: emptyFn
});

// exists([criteria]) - tests if collection has items (optionally matching criteria)
FunctionRegistry.register({
  name: 'exists',
  arguments: [{
    name: 'criteria',
    type: 'expression',
    optional: true,
    evaluationMode: 'lazy'
  }],
  evaluate: existsFn
});

// count() - returns number of items
FunctionRegistry.register({
  name: 'count',
  evaluate: countFn
});

// all([criteria]) - tests if all items are true or match criteria
FunctionRegistry.register({
  name: 'all',
  arguments: [{
    name: 'criteria',
    type: 'expression',
    optional: true,
    evaluationMode: 'lazy'
  }],
  evaluate: allFn
});

// allTrue() - tests if all items are true
FunctionRegistry.register({
  name: 'allTrue',
  inputType: 'boolean',
  evaluate: allTrueFn
});

// anyTrue() - tests if any item is true
FunctionRegistry.register({
  name: 'anyTrue',
  inputType: 'boolean',
  evaluate: anyTrueFn
});

// allFalse() - tests if all items are false
FunctionRegistry.register({
  name: 'allFalse',
  inputType: 'boolean',
  evaluate: allFalseFn
});

// anyFalse() - tests if any item is false
FunctionRegistry.register({
  name: 'anyFalse',
  inputType: 'boolean',
  evaluate: anyFalseFn
});

// distinct() - returns unique items
FunctionRegistry.register({
  name: 'distinct',
  evaluate: distinctFn
});

// isDistinct() - tests if all items are unique
FunctionRegistry.register({
  name: 'isDistinct',
  evaluate: isDistinctFn
});