import type { Function } from '../types';
import { defaultFunctionAnalyze } from '../default-analyzers';
import { toSingleton } from '../../interpreter/helpers';

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
    for (const item of input) {
      const result = interpreter.evaluate(criteria, [item], context);
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
        for (const item of inputVal) {
          const newCtx = { ...ctx, input: [item] };
          const result = criteria.fn(newCtx);
          if (result.length > 0 && toSingleton(result)) {
            return [true];
          }
        }
        return [false];
      },
      type: compiler.resolveType('Boolean'),
      isSingleton: true,
      source: `${input.source || ''}.exists(${criteria.source || ''})`
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
      throw new Error('single() requires exactly one element');
    }
    return { value: input, context };
  },
  
  compile: (compiler, input, args) => ({
    fn: (ctx) => {
      const inputVal = input.fn(ctx);
      if (inputVal.length === 0) return [];
      if (inputVal.length !== 1) {
        throw new Error('single() requires exactly one element');
      }
      return inputVal;
    },
    type: input.type,
    isSingleton: true,
    source: `${input.source || ''}.single()`
  })
};

// Export all existence functions
export const existenceFunctions = [
  existsFunction,
  emptyFunction,
  countFunction,
  firstFunction,
  lastFunction,
  singleFunction
];