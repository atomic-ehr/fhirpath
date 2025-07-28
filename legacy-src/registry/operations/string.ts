import type { Function } from '../types';
import { defaultFunctionAnalyze } from '../default-analyzers';
import { defaultFunctionCompile } from '../default-compilers';

export const containsFunction: Function = {
  name: 'contains',
  kind: 'function',
  
  syntax: {
    notation: 'contains(substring)'
  },
  
  signature: {
    input: {
      types: { kind: 'primitive', types: ['String'] },
      cardinality: 'singleton'
    },
    parameters: [
      {
        name: 'substring',
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
  
  evaluate: (interpreter, context, input, substring) => {
    const str = input[0];
    return { value: [str.includes(substring)], context };
  },
  
  compile: defaultFunctionCompile
};

export const lengthFunction: Function = {
  name: 'length',
  kind: 'function',
  
  syntax: {
    notation: 'length()'
  },
  
  signature: {
    input: {
      types: { kind: 'primitive', types: ['String'] },
      cardinality: 'singleton'
    },
    parameters: [],
    output: {
      type: 'Integer',
      cardinality: 'singleton'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input) => {
    const str = input[0];
    return { value: [str.length], context };
  },
  
  compile: defaultFunctionCompile
};

export const substringFunction: Function = {
  name: 'substring',
  kind: 'function',
  
  syntax: {
    notation: 'substring(start, length)'
  },
  
  signature: {
    input: {
      types: { kind: 'primitive', types: ['String'] },
      cardinality: 'singleton'
    },
    parameters: [
      {
        name: 'start',
        kind: 'value',
        types: { kind: 'primitive', types: ['Integer'] },
        cardinality: 'singleton',
        optional: false
      },
      {
        name: 'length',
        kind: 'value',
        types: { kind: 'primitive', types: ['Integer'] },
        cardinality: 'singleton',
        optional: true
      }
    ],
    output: {
      type: 'String',
      cardinality: 'singleton'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input, start, length) => {
    const str = input[0];
    
    if (start >= str.length) {
      return { value: [''], context };
    }
    
    const result = length !== undefined 
      ? str.substring(start, start + length)
      : str.substring(start);
      
    return { value: [result], context };
  },
  
  compile: defaultFunctionCompile
};

export const startsWithFunction: Function = {
  name: 'startsWith',
  kind: 'function',
  
  syntax: {
    notation: 'startsWith(prefix)'
  },
  
  signature: {
    input: {
      types: { kind: 'primitive', types: ['String'] },
      cardinality: 'singleton'
    },
    parameters: [
      {
        name: 'prefix',
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
  
  evaluate: (interpreter, context, input, prefix) => {
    const str = input[0];
    return { value: [str.startsWith(prefix)], context };
  },
  
  compile: defaultFunctionCompile
};

export const endsWithFunction: Function = {
  name: 'endsWith',
  kind: 'function',
  
  syntax: {
    notation: 'endsWith(suffix)'
  },
  
  signature: {
    input: {
      types: { kind: 'primitive', types: ['String'] },
      cardinality: 'singleton'
    },
    parameters: [
      {
        name: 'suffix',
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
  
  evaluate: (interpreter, context, input, suffix) => {
    const str = input[0];
    return { value: [str.endsWith(suffix)], context };
  },
  
  compile: defaultFunctionCompile
};

export const upperFunction: Function = {
  name: 'upper',
  kind: 'function',
  
  syntax: {
    notation: 'upper()'
  },
  
  signature: {
    input: {
      types: { kind: 'primitive', types: ['String'] },
      cardinality: 'singleton'
    },
    parameters: [],
    output: {
      type: 'String',
      cardinality: 'singleton'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input) => {
    const str = input[0];
    return { value: [str.toUpperCase()], context };
  },
  
  compile: defaultFunctionCompile
};

export const lowerFunction: Function = {
  name: 'lower',
  kind: 'function',
  
  syntax: {
    notation: 'lower()'
  },
  
  signature: {
    input: {
      types: { kind: 'primitive', types: ['String'] },
      cardinality: 'singleton'
    },
    parameters: [],
    output: {
      type: 'String',
      cardinality: 'singleton'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input) => {
    const str = input[0];
    return { value: [str.toLowerCase()], context };
  },
  
  compile: defaultFunctionCompile
};

export const indexOfFunction: Function = {
  name: 'indexOf',
  kind: 'function',
  
  syntax: {
    notation: 'indexOf(substring)'
  },
  
  signature: {
    input: {
      types: { kind: 'primitive', types: ['String'] },
      cardinality: 'singleton'
    },
    parameters: [
      {
        name: 'substring',
        kind: 'value',
        types: { kind: 'primitive', types: ['String'] },
        cardinality: 'singleton',
        optional: false
      }
    ],
    output: {
      type: 'Integer',
      cardinality: 'singleton'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input, substring) => {
    const str = input[0];
    const index = str.indexOf(substring);
    return { value: index === -1 ? [] : [index], context };
  },
  
  compile: defaultFunctionCompile
};

export const replaceFunction: Function = {
  name: 'replace',
  kind: 'function',
  
  syntax: {
    notation: 'replace(pattern, substitution)'
  },
  
  signature: {
    input: {
      types: { kind: 'primitive', types: ['String'] },
      cardinality: 'singleton'
    },
    parameters: [
      {
        name: 'pattern',
        kind: 'value',
        types: { kind: 'primitive', types: ['String'] },
        cardinality: 'singleton',
        optional: false
      },
      {
        name: 'substitution',
        kind: 'value',
        types: { kind: 'primitive', types: ['String'] },
        cardinality: 'singleton',
        optional: false
      }
    ],
    output: {
      type: 'String',
      cardinality: 'singleton'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input, pattern, substitution) => {
    const str = input[0];
    // Replace all occurrences
    return { value: [str.split(pattern).join(substitution)], context };
  },
  
  compile: defaultFunctionCompile
};

export const splitFunction: Function = {
  name: 'split',
  kind: 'function',
  
  syntax: {
    notation: 'split(separator)'
  },
  
  signature: {
    input: {
      types: { kind: 'primitive', types: ['String'] },
      cardinality: 'singleton'
    },
    parameters: [
      {
        name: 'separator',
        kind: 'value',
        types: { kind: 'primitive', types: ['String'] },
        cardinality: 'singleton',
        optional: false
      }
    ],
    output: {
      type: 'String',
      cardinality: 'collection'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input, separator) => {
    const str = input[0];
    return { value: str.split(separator), context };
  },
  
  compile: defaultFunctionCompile
};

export const joinFunction: Function = {
  name: 'join',
  kind: 'function',
  
  syntax: {
    notation: 'join(separator)'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'collection'
    },
    parameters: [
      {
        name: 'separator',
        kind: 'value',
        types: { kind: 'primitive', types: ['String'] },
        cardinality: 'singleton',
        optional: false
      }
    ],
    output: {
      type: 'String',
      cardinality: 'singleton'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input, separator) => {
    return { value: [input.join(separator)], context };
  },
  
  compile: defaultFunctionCompile
};

export const trimFunction: Function = {
  name: 'trim',
  kind: 'function',
  
  syntax: {
    notation: 'trim()'
  },
  
  signature: {
    input: {
      types: { kind: 'primitive', types: ['String'] },
      cardinality: 'singleton'
    },
    parameters: [],
    output: {
      type: 'String',
      cardinality: 'singleton'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input) => {
    const str = input[0];
    return { value: [str.trim()], context };
  },
  
  compile: defaultFunctionCompile
};

export const toCharsFunction: Function = {
  name: 'toChars',
  kind: 'function',
  
  syntax: {
    notation: 'toChars()'
  },
  
  signature: {
    input: {
      types: { kind: 'primitive', types: ['String'] },
      cardinality: 'singleton'
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
    const str = input[0];
    return { value: Array.from(str), context };
  },
  
  compile: defaultFunctionCompile
};