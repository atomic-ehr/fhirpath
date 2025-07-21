import { FunctionRegistry } from './registry';

// Collection combining functions

// Standalone function implementations
export const unionFn = (interpreter: any, context: any, input: any[], otherExpr: any) => {
  const otherResult = interpreter.evaluate(otherExpr, input, context);
  const other = otherResult.value;
  
  // Combine without duplicates
  const seen = new Set();
  const result: any[] = [];
  
  for (const item of input) {
    const key = JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  
  for (const item of other) {
    const key = JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  
  return { value: result, context: otherResult.context };
};

export const combineFn = (interpreter: any, context: any, input: any[], otherExpr: any) => {
  const otherResult = interpreter.evaluate(otherExpr, input, context);
  const other = otherResult.value;
  
  // Simple concatenation
  return { value: [...input, ...other], context: otherResult.context };
};

export const intersectFn = (interpreter: any, context: any, input: any[], otherExpr: any) => {
  const otherResult = interpreter.evaluate(otherExpr, input, context);
  const other = otherResult.value;
  
  const otherSet = new Set(other.map((item: any) => JSON.stringify(item)));
  const result: any[] = [];
  const seen = new Set();
  
  for (const item of input) {
    const key = JSON.stringify(item);
    if (otherSet.has(key) && !seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  
  return { value: result, context: otherResult.context };
};

export const excludeFn = (interpreter: any, context: any, input: any[], otherExpr: any) => {
  const otherResult = interpreter.evaluate(otherExpr, input, context);
  const other = otherResult.value;
  
  const excludeSet = new Set(other.map((item: any) => JSON.stringify(item)));
  const result: any[] = [];
  const seen = new Set();
  
  for (const item of input) {
    const key = JSON.stringify(item);
    if (!excludeSet.has(key) && !seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  
  return { value: result, context: otherResult.context };
};

// Register functions with new signature

// union(other) - combines collections without duplicates
FunctionRegistry.register({
  name: 'union',
  arguments: [{
    name: 'other',
    type: 'expression',
    evaluationMode: 'lazy'
  }],
  evaluate: unionFn
});

// combine(other) - concatenates collections
FunctionRegistry.register({
  name: 'combine',
  arguments: [{
    name: 'other',
    type: 'expression',
    evaluationMode: 'lazy'
  }],
  evaluate: combineFn
});

// intersect(other) - returns common elements
FunctionRegistry.register({
  name: 'intersect',
  arguments: [{
    name: 'other',
    type: 'expression',
    evaluationMode: 'lazy'
  }],
  evaluate: intersectFn
});

// exclude(other) - removes elements
FunctionRegistry.register({
  name: 'exclude',
  arguments: [{
    name: 'other',
    type: 'expression',
    evaluationMode: 'lazy'
  }],
  evaluate: excludeFn
});