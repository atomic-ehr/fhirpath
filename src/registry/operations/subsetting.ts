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
  
  compile: defaultFunctionCompile
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
  
  compile: defaultFunctionCompile
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
  
  compile: defaultFunctionCompile
};