import { FunctionRegistry } from './registry';

// Type checking functions

// Standalone function implementations
export const typeFn = (interpreter: any, context: any, input: any[]) => {
  const { TypeSystem } = require('../types/type-system');
  const types = new Set<string>();
  
  for (const item of input) {
    types.add(TypeSystem.getType(item));
  }
  
  return { value: Array.from(types), context };
};

export const isFn = (interpreter: any, context: any, input: any[], typeName: string) => {
  const { TypeSystem } = require('../types/type-system');
  
  if (input.length === 0) {
    return { value: [], context };
  }
  
  // Check if all items match the type
  for (const item of input) {
    if (!TypeSystem.isType(item, typeName)) {
      return { value: [false], context };
    }
  }
  
  return { value: [true], context };
};

export const asFn = (interpreter: any, context: any, input: any[], typeName: string) => {
  const { TypeSystem } = require('../types/type-system');
  const results: any[] = [];
  
  for (const item of input) {
    if (TypeSystem.isType(item, typeName)) {
      results.push(item);
    }
  }
  
  return { value: results, context };
};


// Register functions with new signature

// type() - returns type of items
FunctionRegistry.register({
  name: 'type',
  evaluate: typeFn
});

// is(type) - checks if all items are of given type
FunctionRegistry.register({
  name: 'is',
  arguments: [{
    name: 'type',
    type: 'string',
    evaluationMode: 'type-only'
  }],
  evaluate: isFn
});

// as(type) - filters items by type (same as ofType)
FunctionRegistry.register({
  name: 'as',
  arguments: [{
    name: 'type',
    type: 'string',
    evaluationMode: 'type-only'
  }],
  evaluate: asFn
});

