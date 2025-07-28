import type { Function } from '../types';
import { defaultFunctionAnalyze } from '../default-analyzers';
import { isTruthy, toSingleton } from '../utils';
import { RuntimeContextManager } from '../../runtime/context';

export const existsFunction: Function = {
  name: 'exists',
  kind: 'function',
  
  syntax: {
    notation: 'exists([criteria])'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [
      {
        name: 'criteria',
        kind: 'expression',
        types: { kind: 'any' },
        cardinality: 'any',
        optional: true
      }
    ],
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    },
    propagatesEmpty: false, // exists() on empty returns false
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input, ...args) => {
    const criteria = args[0];
    if (!criteria) {
      // No criteria: check if input is non-empty
      return { value: [input.length > 0], context };
    }
    
    // With criteria: check if any element matches
    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      const iterContext = RuntimeContextManager.withIterator(context, item, i);
      const result = interpreter.evaluate(criteria, [item], iterContext);
      if (result.value.length > 0 && toSingleton(result.value)) {
        return { value: [true], context: result.context };
      }
    }
    
    return { value: [false], context };
  },
  
  compile: (compiler, input, args) => {
    if (args.length === 0) {
      // No criteria
      return {
        fn: (ctx) => {
          const inputVal = input.fn(ctx);
          return [inputVal.length > 0];
        },
        type: compiler.resolveType('Boolean'),
        isSingleton: true,
        source: `${input.source || ''}.exists()`
      };
    }
    
    // With criteria
    const criteria = args[0];
    return {
      fn: (ctx) => {
        const inputVal = input.fn(ctx);
        for (let i = 0; i < inputVal.length; i++) {
          const item = inputVal[i];
          const newCtx = RuntimeContextManager.withIterator(ctx, item, i);
          const result = criteria?.fn(newCtx) || [];
          if (result.length > 0 && toSingleton(result)) {
            return [true];
          }
        }
        return [false];
      },
      type: compiler.resolveType('Boolean'),
      isSingleton: true,
      source: `${input.source || ''}.exists(${criteria?.source || ''})`
    };
  }
};

export const emptyFunction: Function = {
  name: 'empty',
  kind: 'function',
  
  syntax: {
    notation: 'empty()'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [],
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    },
    propagatesEmpty: false, // empty() on empty returns true
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input) => {
    return { value: [input.length === 0], context };
  },
  
  compile: (compiler, input, args) => ({
    fn: (ctx) => {
      const inputVal = input.fn(ctx);
      return [inputVal.length === 0];
    },
    type: compiler.resolveType('Boolean'),
    isSingleton: true,
    source: `${input.source || ''}.empty()`
  })
};

export const countFunction: Function = {
  name: 'count',
  kind: 'function',
  
  syntax: {
    notation: 'count()'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [],
    output: {
      type: 'Integer',
      cardinality: 'singleton'
    },
    propagatesEmpty: false, // count() on empty returns 0
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input) => {
    return { value: [input.length], context };
  },
  
  compile: (compiler, input, args) => ({
    fn: (ctx) => {
      const inputVal = input.fn(ctx);
      return [inputVal.length];
    },
    type: compiler.resolveType('Integer'),
    isSingleton: true,
    source: `${input.source || ''}.count()`
  })
};

export const firstFunction: Function = {
  name: 'first',
  kind: 'function',
  
  syntax: {
    notation: 'first()'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [],
    output: {
      type: 'preserve-input',
      cardinality: 'singleton'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input) => {
    if (input.length === 0) return { value: [], context };
    return { value: [input[0]], context };
  },
  
  compile: (compiler, input, args) => ({
    fn: (ctx) => {
      const inputVal = input.fn(ctx);
      if (inputVal.length === 0) return [];
      return [inputVal[0]];
    },
    type: input.type,
    isSingleton: true,
    source: `${input.source || ''}.first()`
  })
};

export const lastFunction: Function = {
  name: 'last',
  kind: 'function',
  
  syntax: {
    notation: 'last()'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [],
    output: {
      type: 'preserve-input',
      cardinality: 'singleton'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input) => {
    if (input.length === 0) return { value: [], context };
    return { value: [input[input.length - 1]], context };
  },
  
  compile: (compiler, input, args) => ({
    fn: (ctx) => {
      const inputVal = input.fn(ctx);
      if (inputVal.length === 0) return [];
      return [inputVal[inputVal.length - 1]];
    },
    type: input.type,
    isSingleton: true,
    source: `${input.source || ''}.last()`
  })
};

export const singleFunction: Function = {
  name: 'single',
  kind: 'function',
  
  syntax: {
    notation: 'single()'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [],
    output: {
      type: 'preserve-input',
      cardinality: 'singleton'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input) => {
    if (input.length === 0) return { value: [], context };
    if (input.length !== 1) {
      throw new Error('single() requires collection to have exactly one item');
    }
    return { value: input, context };
  },
  
  compile: (compiler, input, args) => ({
    fn: (ctx) => {
      const inputVal = input.fn(ctx);
      if (inputVal.length === 0) return [];
      if (inputVal.length !== 1) {
        throw new Error('single() requires collection to have exactly one item');
      }
      return inputVal;
    },
    type: input.type,
    isSingleton: true,
    source: `${input.source || ''}.single()`
  })
};

export const allFunction: Function = {
  name: 'all',
  kind: 'function',
  
  syntax: {
    notation: 'all([criteria])'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [
      {
        name: 'criteria',
        kind: 'expression',
        types: { kind: 'any' },
        cardinality: 'any',
        optional: true
      }
    ],
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    },
    propagatesEmpty: false,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input, criteria) => {
    if (input.length === 0) {
      return { value: [true], context };
    }
    
    if (!criteria) {
      return { value: [input.every(item => item === true)], context };
    }
    
    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      const iterContext = RuntimeContextManager.withIterator(context, item, i);
      const result = interpreter.evaluate(criteria, [item], iterContext);
      
      if (!isTruthy(result.value)) {
        return { value: [false], context };
      }
    }
    
    return { value: [true], context };
  },
  
  compile: (compiler, input, args) => {
    if (args.length === 0 || !args[0]) {
      // No criteria - check if all items are true
      return {
        fn: (ctx) => {
          const inputVal = input.fn(ctx);
          if (inputVal.length === 0) {
            return [true];
          }
          return [inputVal.every(item => item === true)];
        },
        type: compiler.resolveType('Boolean'),
        isSingleton: true,
        source: `${input.source || ''}.all()`
      };
    }
    
    // With criteria
    const criteria = args[0];
    return {
      fn: (ctx) => {
        const inputVal = input.fn(ctx);
        if (inputVal.length === 0) {
          return [true];
        }
        
        for (let i = 0; i < inputVal.length; i++) {
          const item = inputVal[i];
          const newCtx = RuntimeContextManager.withIterator(ctx, item, i);
          const result = criteria?.fn(newCtx) || [];
          
          if (!isTruthy(result)) {
            return [false];
          }
        }
        
        return [true];
      },
      type: compiler.resolveType('Boolean'),
      isSingleton: true,
      source: `${input.source || ''}.all(${criteria.source || ''})`
    };
  }
};

export const allTrueFunction: Function = {
  name: 'allTrue',
  kind: 'function',
  
  syntax: {
    notation: 'allTrue()'
  },
  
  signature: {
    input: {
      types: { kind: 'primitive', types: ['Boolean'] },
      cardinality: 'any'
    },
    parameters: [],
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    },
    propagatesEmpty: false,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input) => {
    return { value: [input.every(item => item === true)], context };
  },
  
  compile: (compiler, input, args) => {
    return {
      fn: (ctx) => {
        const inputVal = input.fn(ctx);
        return [inputVal.every(item => item === true)];
      },
      type: compiler.resolveType('Boolean'),
      isSingleton: true,
      source: `${input.source || ''}.allTrue()`
    };
  }
};

export const anyTrueFunction: Function = {
  name: 'anyTrue',
  kind: 'function',
  
  syntax: {
    notation: 'anyTrue()'
  },
  
  signature: {
    input: {
      types: { kind: 'primitive', types: ['Boolean'] },
      cardinality: 'any'
    },
    parameters: [],
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    },
    propagatesEmpty: false,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input) => {
    return { value: [input.some(item => item === true)], context };
  },
  
  compile: (compiler, input, args) => {
    return {
      fn: (ctx) => {
        const inputVal = input.fn(ctx);
        return [inputVal.some(item => item === true)];
      },
      type: compiler.resolveType('Boolean'),
      isSingleton: true,
      source: `${input.source || ''}.anyTrue()`
    };
  }
};

export const allFalseFunction: Function = {
  name: 'allFalse',
  kind: 'function',
  
  syntax: {
    notation: 'allFalse()'
  },
  
  signature: {
    input: {
      types: { kind: 'primitive', types: ['Boolean'] },
      cardinality: 'any'
    },
    parameters: [],
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    },
    propagatesEmpty: false,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input) => {
    return { value: [input.every(item => item === false)], context };
  },
  
  compile: (compiler, input, args) => {
    return {
      fn: (ctx) => {
        const inputVal = input.fn(ctx);
        return [inputVal.every(item => item === false)];
      },
      type: compiler.resolveType('Boolean'),
      isSingleton: true,
      source: `${input.source || ''}.allFalse()`
    };
  }
};

export const anyFalseFunction: Function = {
  name: 'anyFalse',
  kind: 'function',
  
  syntax: {
    notation: 'anyFalse()'
  },
  
  signature: {
    input: {
      types: { kind: 'primitive', types: ['Boolean'] },
      cardinality: 'any'
    },
    parameters: [],
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    },
    propagatesEmpty: false,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input) => {
    return { value: [input.some(item => item === false)], context };
  },
  
  compile: (compiler, input, args) => {
    return {
      fn: (ctx) => {
        const inputVal = input.fn(ctx);
        return [inputVal.some(item => item === false)];
      },
      type: compiler.resolveType('Boolean'),
      isSingleton: true,
      source: `${input.source || ''}.anyFalse()`
    };
  }
};

export const distinctFunction: Function = {
  name: 'distinct',
  kind: 'function',
  
  syntax: {
    notation: 'distinct()'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [],
    output: {
      type: 'preserve-input',
      cardinality: 'collection'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input) => {
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
  },
  
  compile: (compiler, input, args) => {
    return {
      fn: (ctx) => {
        const inputVal = input.fn(ctx);
        const seen = new Set();
        const result: any[] = [];
        
        for (const item of inputVal) {
          const key = JSON.stringify(item);
          if (!seen.has(key)) {
            seen.add(key);
            result.push(item);
          }
        }
        
        return result;
      },
      type: input.type,
      isSingleton: false,
      source: `${input.source || ''}.distinct()`
    };
  }
};

export const isDistinctFunction: Function = {
  name: 'isDistinct',
  kind: 'function',
  
  syntax: {
    notation: 'isDistinct()'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [],
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    },
    propagatesEmpty: false,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input) => {
    const seen = new Set();
    
    for (const item of input) {
      const key = JSON.stringify(item);
      if (seen.has(key)) {
        return { value: [false], context };
      }
      seen.add(key);
    }
    
    return { value: [true], context };
  },
  
  compile: (compiler, input, args) => {
    return {
      fn: (ctx) => {
        const inputVal = input.fn(ctx);
        const seen = new Set();
        
        for (const item of inputVal) {
          const key = JSON.stringify(item);
          if (seen.has(key)) {
            return [false];
          }
          seen.add(key);
        }
        
        return [true];
      },
      type: compiler.resolveType('Boolean'),
      isSingleton: true,
      source: `${input.source || ''}.isDistinct()`
    };
  }
};

// Export all existence functions
export const existenceFunctions = [
  existsFunction,
  emptyFunction,
  countFunction,
  firstFunction,
  lastFunction,
  singleFunction,
  allFunction,
  allTrueFunction,
  anyTrueFunction,
  allFalseFunction,
  anyFalseFunction,
  distinctFunction,
  isDistinctFunction
];