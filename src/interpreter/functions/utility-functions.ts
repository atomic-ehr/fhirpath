import { FunctionRegistry } from './registry';
import { ContextManager } from '../context';

// Utility functions

// Standalone function implementations

export const aggregateFn = (interpreter: any, context: any, input: any[], aggregatorExpr: any, init?: any) => {
  if (!aggregatorExpr) {
    throw new Error('aggregate() requires an aggregator expression');
  }
  
  let total = init !== undefined ? init : [];
  
  for (let i = 0; i < input.length; i++) {
    const item = input[i];
    // Set up context with $this, $index, and $total
    const iterContext = {
      ...ContextManager.setIteratorContext(context, item, i),
      env: {
        ...context.env,
        $this: [item],
        $index: i,
        $total: total
      }
    };
    
    // Evaluate aggregator expression
    const result = interpreter.evaluate(aggregatorExpr, [item], iterContext);
    total = result.value;
  }
  
  return { value: total, context };
};

export const childrenFn = (interpreter: any, context: any, input: any[]) => {
  const results: any[] = [];
  
  for (const item of input) {
    if (item && typeof item === 'object') {
      // Get all property values
      for (const key of Object.keys(item)) {
        // Skip metadata properties (starting with _)
        if (!key.startsWith('_')) {
          const value = item[key];
          if (Array.isArray(value)) {
            results.push(...value);
          } else if (value !== null && value !== undefined) {
            results.push(value);
          }
        }
      }
    }
  }
  
  return { value: results, context };
};

export const descendantsFn = (interpreter: any, context: any, input: any[]) => {
  const results: any[] = [];
  const seen = new Set();
  
  function collectDescendants(items: any[]) {
    for (const item of items) {
      if (item && typeof item === 'object') {
        const key = JSON.stringify(item);
        if (!seen.has(key)) {
          seen.add(key);
          results.push(item);
          
          // Get children and recurse
          const children: any[] = [];
          for (const prop of Object.keys(item)) {
            if (!prop.startsWith('_')) {
              const value = item[prop];
              if (Array.isArray(value)) {
                children.push(...value);
              } else if (value !== null && value !== undefined && typeof value === 'object') {
                children.push(value);
              }
            }
          }
          collectDescendants(children);
        }
      }
    }
  }
  
  // Start with children of input
  const children: any[] = [];
  for (const item of input) {
    if (item && typeof item === 'object') {
      for (const key of Object.keys(item)) {
        if (!key.startsWith('_')) {
          const value = item[key];
          if (Array.isArray(value)) {
            children.push(...value);
          } else if (value !== null && value !== undefined) {
            children.push(value);
          }
        }
      }
    }
  }
  
  collectDescendants(children);
  return { value: results, context };
};

// Register functions with new signature


// aggregate(aggregator, init) - general aggregation
FunctionRegistry.register({
  name: 'aggregate',
  arguments: [
    {
      name: 'aggregator',
      type: 'expression',
      evaluationMode: 'lazy'
    },
    {
      name: 'init',
      type: 'any',
      optional: true,
      defaultValue: []
    }
  ],
  evaluate: aggregateFn
});

// children() - returns all child nodes
FunctionRegistry.register({
  name: 'children',
  evaluate: childrenFn
});

// descendants() - returns all descendant nodes
FunctionRegistry.register({
  name: 'descendants',
  evaluate: descendantsFn
});