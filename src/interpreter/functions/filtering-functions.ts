import { FunctionRegistry } from './registry';
import { ContextManager } from '../context';
import { isTruthy } from '../helpers';

// Filtering and transformation functions

// Standalone function implementations
export const whereFn = (interpreter: any, context: any, input: any[], criteria: any) => {
  const results: any[] = [];
  if (!criteria) {
    throw new Error('where() requires a predicate expression');
  }

  for (let i = 0; i < input.length; i++) {
    const item = input[i];
    // Set $this and $index for the predicate evaluation
    const iterContext = ContextManager.setIteratorContext(context, item, i);
    const result = interpreter.evaluate(criteria, [item], iterContext);
    
    if (isTruthy(result.value)) {
      results.push(item);
    }
  }

  return { value: results, context };
};

export const selectFn = (interpreter: any, context: any, input: any[], expression: any) => {
  const results: any[] = [];
  if (!expression) {
    throw new Error('select() requires an expression');
  }

  for (let i = 0; i < input.length; i++) {
    const item = input[i];
    // Set $this and $index for the expression evaluation
    const iterContext = ContextManager.setIteratorContext(context, item, i);
    const result = interpreter.evaluate(expression, [item], iterContext);
    results.push(...result.value);
  }

  return { value: results, context };
};

export const ofTypeFn = (interpreter: any, context: any, input: any[], typeName: string) => {
  const results: any[] = [];
  
  for (const item of input) {
    // Check if item matches the type
    if (isOfType(item, typeName)) {
      results.push(item);
    }
  }
  
  return { value: results, context };
};

export const repeatFn = (interpreter: any, context: any, input: any[], expression: any) => {
  let current = input;
  const seen = new Set();
  
  while (current.length > 0) {
    const nextResults: any[] = [];
    
    for (let i = 0; i < current.length; i++) {
      const item = current[i];
      const itemKey = JSON.stringify(item);
      
      if (!seen.has(itemKey)) {
        seen.add(itemKey);
        const iterContext = ContextManager.setIteratorContext(context, item, i);
        const result = interpreter.evaluate(expression, [item], iterContext);
        nextResults.push(...result.value);
      }
    }
    
    current = nextResults;
  }
  
  return { value: Array.from(seen).map(key => JSON.parse(key as string)), context };
};

// Helper function for type checking
function isOfType(item: any, typeName: string): boolean {
  // Handle FHIR resource types
  if (item && typeof item === 'object' && item.resourceType === typeName) {
    return true;
  }
  
  // Handle primitive types
  switch (typeName) {
    case 'String':
      return typeof item === 'string';
    case 'Boolean':
      return typeof item === 'boolean';
    case 'Integer':
      return typeof item === 'number' && Number.isInteger(item);
    case 'Decimal':
      return typeof item === 'number';
    default:
      return false;
  }
}

// Register functions with new signature

// where(expression) - filters input collection
FunctionRegistry.register({
  name: 'where',
  arguments: [{
    name: 'criteria',
    type: 'expression',
    evaluationMode: 'lazy'
  }],
  evaluate: whereFn
});

// select(expression) - transforms each item
FunctionRegistry.register({
  name: 'select',
  arguments: [{
    name: 'expression',
    type: 'expression',
    evaluationMode: 'lazy'
  }],
  evaluate: selectFn
});

// ofType(type) - filters by type
FunctionRegistry.register({
  name: 'ofType',
  arguments: [{
    name: 'type',
    type: 'string',
    evaluationMode: 'type-only'
  }],
  evaluate: ofTypeFn
});

// repeat(expression) - recursively applies expression
FunctionRegistry.register({
  name: 'repeat',
  arguments: [{
    name: 'expression',
    type: 'expression',
    evaluationMode: 'lazy'
  }],
  evaluate: repeatFn
});