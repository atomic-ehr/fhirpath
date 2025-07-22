import type { Function } from '../types';
import { defaultFunctionAnalyze } from '../default-analyzers';
import { defaultFunctionCompile } from '../default-compilers';
import { CollectionUtils } from '../../interpreter/types';

export const absFunction: Function = {
  name: 'abs',
  kind: 'function',
  
  syntax: {
    notation: 'abs()'
  },
  
  signature: {
    input: {
      types: { kind: 'union', types: ['Integer', 'Decimal', 'Quantity'] },
      cardinality: 'singleton'
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
    if (input.length === 0) {
      return { value: [], context };
    }
    const num = CollectionUtils.toSingleton(input);
    return { value: [Math.abs(num)], context };
  },
  
  compile: defaultFunctionCompile
};

export const roundFunction: Function = {
  name: 'round',
  kind: 'function',
  
  syntax: {
    notation: 'round(precision)'
  },
  
  signature: {
    input: {
      types: { kind: 'union', types: ['Decimal'] },
      cardinality: 'singleton'
    },
    parameters: [
      {
        name: 'precision',
        kind: 'value',
        types: { kind: 'primitive', types: ['Integer'] },
        cardinality: 'singleton',
        optional: true
      }
    ],
    output: {
      type: 'Decimal',
      cardinality: 'singleton'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input, precision) => {
    if (input.length === 0) {
      return { value: [], context };
    }
    const num = CollectionUtils.toSingleton(input);
    
    if (precision === undefined) {
      return { value: [Math.round(num)], context };
    }
    
    const factor = Math.pow(10, precision);
    return { value: [Math.round(num * factor) / factor], context };
  },
  
  compile: defaultFunctionCompile
};

export const sqrtFunction: Function = {
  name: 'sqrt',
  kind: 'function',
  
  syntax: {
    notation: 'sqrt()'
  },
  
  signature: {
    input: {
      types: { kind: 'union', types: ['Decimal'] },
      cardinality: 'singleton'
    },
    parameters: [],
    output: {
      type: 'Decimal',
      cardinality: 'singleton'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input) => {
    if (input.length === 0) {
      return { value: [], context };
    }
    const num = CollectionUtils.toSingleton(input);
    
    if (num < 0) {
      return { value: [], context };
    }
    
    return { value: [Math.sqrt(num)], context };
  },
  
  compile: defaultFunctionCompile
};