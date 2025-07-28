import type { Function } from '../types';
import { defaultFunctionAnalyze } from '../default-analyzers';
import { defaultFunctionCompile } from '../default-compilers';

export const tailFunction: Function = {
  name: 'tail',
  kind: 'function',
  
  syntax: {
    notation: 'tail()'
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
    return { value: input.slice(1), context };
  },
  
  compile: (compiler, input, args) => {
    return {
      fn: (ctx) => {
        const inputVal = input.fn(ctx);
        return inputVal.slice(1);
      },
      type: input.type,
      isSingleton: false,
      source: `${input.source || ''}.tail()`
    };
  }
};

export const skipFunction: Function = {
  name: 'skip',
  kind: 'function',
  
  syntax: {
    notation: 'skip(count)'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [
      {
        name: 'count',
        kind: 'value',
        types: { kind: 'primitive', types: ['Integer'] },
        cardinality: 'singleton',
        optional: false
      }
    ],
    output: {
      type: 'preserve-input',
      cardinality: 'collection'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input, count) => {
    return { value: input.slice(count), context };
  },
  
  compile: (compiler, input, args) => {
    const countExpr = args[0];
    if (!countExpr) {
      throw new Error('skip() requires a count parameter');
    }
    
    return {
      fn: (ctx) => {
        const inputVal = input.fn(ctx);
        const countResult = countExpr.fn(ctx);
        
        if (countResult.length === 0) {
          return inputVal;
        }
        
        const count = countResult[0];
        if (typeof count !== 'number' || !Number.isInteger(count)) {
          throw new Error('skip() count must be an integer');
        }
        
        return inputVal.slice(count);
      },
      type: input.type,
      isSingleton: false,
      source: `${input.source || ''}.skip(${countExpr.source || ''})`
    };
  }
};

export const takeFunction: Function = {
  name: 'take',
  kind: 'function',
  
  syntax: {
    notation: 'take(count)'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [
      {
        name: 'count',
        kind: 'value',
        types: { kind: 'primitive', types: ['Integer'] },
        cardinality: 'singleton',
        optional: false
      }
    ],
    output: {
      type: 'preserve-input',
      cardinality: 'collection'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input, count) => {
    return { value: input.slice(0, count), context };
  },
  
  compile: (compiler, input, args) => {
    const countExpr = args[0];
    if (!countExpr) {
      throw new Error('take() requires a count parameter');
    }
    
    return {
      fn: (ctx) => {
        const inputVal = input.fn(ctx);
        const countResult = countExpr.fn(ctx);
        
        if (countResult.length === 0) {
          return [];
        }
        
        const count = countResult[0];
        if (typeof count !== 'number' || !Number.isInteger(count)) {
          throw new Error('take() count must be an integer');
        }
        
        return inputVal.slice(0, count);
      },
      type: input.type,
      isSingleton: false,
      source: `${input.source || ''}.take(${countExpr.source || ''})`
    };
  }
};