import type { Function } from '../types';
import { defaultFunctionAnalyze } from '../default-analyzers';
import { defaultFunctionCompile } from '../default-compilers';

export const unionFunction: Function = {
  name: 'union',
  kind: 'function',
  
  syntax: {
    notation: 'union(other)'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [
      {
        name: 'other',
        kind: 'expression',
        types: { kind: 'any' },
        cardinality: 'any',
        optional: false
      }
    ],
    output: {
      type: 'preserve-input',
      cardinality: 'collection'
    },
    propagatesEmpty: false,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input, otherExpr) => {
    const otherResult = interpreter.evaluate(otherExpr, input, context);
    const other = otherResult.value;
    
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
  },
  
  compile: defaultFunctionCompile
};

export const combineFunction: Function = {
  name: 'combine',
  kind: 'function',
  
  syntax: {
    notation: 'combine(other)'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [
      {
        name: 'other',
        kind: 'expression',
        types: { kind: 'any' },
        cardinality: 'any',
        optional: false
      }
    ],
    output: {
      type: 'preserve-input',
      cardinality: 'collection'
    },
    propagatesEmpty: false,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input, otherExpr) => {
    const otherResult = interpreter.evaluate(otherExpr, input, context);
    const other = otherResult.value;
    
    return { value: [...input, ...other], context: otherResult.context };
  },
  
  compile: defaultFunctionCompile
};

export const intersectFunction: Function = {
  name: 'intersect',
  kind: 'function',
  
  syntax: {
    notation: 'intersect(other)'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [
      {
        name: 'other',
        kind: 'expression',
        types: { kind: 'any' },
        cardinality: 'any',
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
  
  evaluate: (interpreter, context, input, otherExpr) => {
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
  },
  
  compile: defaultFunctionCompile
};

export const excludeFunction: Function = {
  name: 'exclude',
  kind: 'function',
  
  syntax: {
    notation: 'exclude(other)'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'any'
    },
    parameters: [
      {
        name: 'other',
        kind: 'expression',
        types: { kind: 'any' },
        cardinality: 'any',
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
  
  evaluate: (interpreter, context, input, otherExpr) => {
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
  },
  
  compile: defaultFunctionCompile
};