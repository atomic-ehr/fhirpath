import type { Function } from '../types';
import { defaultFunctionAnalyze } from '../default-analyzers';
import { defaultFunctionCompile } from '../default-compilers';
import { TypeSystem } from '../utils/type-system';

export const typeFunction: Function = {
  name: 'type',
  kind: 'function',
  
  syntax: {
    notation: 'type()'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [],
    output: {
      type: 'String',
      cardinality: 'collection'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input) => {
    const types = new Set<string>();
    
    for (const item of input) {
      types.add(TypeSystem.getType(item));
    }
    
    return { value: Array.from(types), context };
  },
  
  compile: defaultFunctionCompile
};

export const isFunction: Function = {
  name: 'is',
  kind: 'function',
  
  syntax: {
    notation: 'is(type)'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [
      {
        name: 'type',
        kind: 'value',
        types: { kind: 'primitive', types: ['String'] },
        cardinality: 'singleton',
        optional: false
      }
    ],
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input, typeName) => {
    if (input.length === 0) {
      return { value: [], context };
    }
    
    for (const item of input) {
      if (!TypeSystem.isType(item, typeName)) {
        return { value: [false], context };
      }
    }
    
    return { value: [true], context };
  },
  
  compile: defaultFunctionCompile
};

export const asFunction: Function = {
  name: 'as',
  kind: 'function',
  
  syntax: {
    notation: 'as(type)'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [
      {
        name: 'type',
        kind: 'value',
        types: { kind: 'primitive', types: ['String'] },
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
  
  evaluate: (interpreter, context, input, typeName) => {
    const results: any[] = [];
    
    for (const item of input) {
      if (TypeSystem.isType(item, typeName)) {
        results.push(item);
      }
    }
    
    return { value: results, context };
  },
  
  compile: defaultFunctionCompile
};