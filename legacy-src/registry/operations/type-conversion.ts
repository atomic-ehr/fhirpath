import type { Function } from '../types';
import { defaultFunctionAnalyze } from '../default-analyzers';
import { defaultFunctionCompile } from '../default-compilers';
import { CollectionUtils } from '../../interpreter/types';

export const toStringFunction: Function = {
  name: 'toString',
  kind: 'function',
  
  syntax: {
    notation: 'toString()'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
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
    if (input.length === 0) {
      return { value: [], context };
    }
    
    const value = CollectionUtils.toSingleton(input);
    
    if (value === null || value === undefined) {
      return { value: [], context };
    }
    
    if (typeof value === 'boolean') {
      return { value: [value ? 'true' : 'false'], context };
    }
    
    return { value: [String(value)], context };
  },
  
  compile: (compiler, input, args) => {
    return {
      fn: (ctx) => {
        const inputValue = input.fn(ctx);
        
        if (inputValue.length === 0) {
          return [];
        }
        
        const value = inputValue[0]; // toSingleton
        
        if (value === null || value === undefined) {
          return [];
        }
        
        if (typeof value === 'boolean') {
          return [value ? 'true' : 'false'];
        }
        
        return [String(value)];
      },
      type: compiler.resolveType('String'),
      isSingleton: true
    };
  }
};

export const toIntegerFunction: Function = {
  name: 'toInteger',
  kind: 'function',
  
  syntax: {
    notation: 'toInteger()'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
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
    if (input.length === 0) {
      return { value: [], context };
    }
    
    const value = CollectionUtils.toSingleton(input);
    
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return { value: [value], context };
      }
      return { value: [Math.trunc(value)], context };
    }
    
    if (typeof value === 'boolean') {
      return { value: [value ? 1 : 0], context };
    }
    
    if (typeof value === 'string') {
      const num = parseInt(value, 10);
      if (!isNaN(num)) {
        return { value: [num], context };
      }
    }
    
    return { value: [], context };
  },
  
  compile: (compiler, input, args) => {
    return {
      fn: (ctx) => {
        const inputValue = input.fn(ctx);
        
        if (inputValue.length === 0) {
          return [];
        }
        
        const value = inputValue[0]; // toSingleton
        
        if (typeof value === 'number') {
          if (Number.isInteger(value)) {
            return [value];
          }
          return [Math.trunc(value)];
        }
        
        if (typeof value === 'boolean') {
          return [value ? 1 : 0];
        }
        
        if (typeof value === 'string') {
          const num = parseInt(value, 10);
          if (!isNaN(num)) {
            return [num];
          }
        }
        
        return [];
      },
      type: compiler.resolveType('Integer'),
      isSingleton: true
    };
  }
};

export const toDecimalFunction: Function = {
  name: 'toDecimal',
  kind: 'function',
  
  syntax: {
    notation: 'toDecimal()'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
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
    
    const value = CollectionUtils.toSingleton(input);
    
    if (typeof value === 'number') {
      return { value: [value], context };
    }
    
    if (typeof value === 'boolean') {
      return { value: [value ? 1.0 : 0.0], context };
    }
    
    if (typeof value === 'string') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return { value: [num], context };
      }
    }
    
    return { value: [], context };
  },
  
  compile: (compiler, input, args) => {
    return {
      fn: (ctx) => {
        const inputValue = input.fn(ctx);
        
        if (inputValue.length === 0) {
          return [];
        }
        
        const value = inputValue[0]; // toSingleton
        
        if (typeof value === 'number') {
          return [value];
        }
        
        if (typeof value === 'boolean') {
          return [value ? 1.0 : 0.0];
        }
        
        if (typeof value === 'string') {
          const num = parseFloat(value);
          if (!isNaN(num)) {
            return [num];
          }
        }
        
        return [];
      },
      type: compiler.resolveType('Decimal'),
      isSingleton: true
    };
  }
};

export const toBooleanFunction: Function = {
  name: 'toBoolean',
  kind: 'function',
  
  syntax: {
    notation: 'toBoolean()'
  },
  
  signature: {
    input: {
      types: { kind: 'any' },
      cardinality: 'singleton'
    },
    parameters: [],
    output: {
      type: 'Boolean',
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
    
    const value = CollectionUtils.toSingleton(input);
    
    if (typeof value === 'boolean') {
      return { value: [value], context };
    }
    
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === 't' || lower === 'yes' || lower === 'y' || lower === '1') {
        return { value: [true], context };
      }
      if (lower === 'false' || lower === 'f' || lower === 'no' || lower === 'n' || lower === '0') {
        return { value: [false], context };
      }
    }
    
    if (typeof value === 'number') {
      if (value === 1) return { value: [true], context };
      if (value === 0) return { value: [false], context };
    }
    
    return { value: [], context };
  },
  
  compile: (compiler, input, args) => {
    return {
      fn: (ctx) => {
        const inputValue = input.fn(ctx);
        
        if (inputValue.length === 0) {
          return [];
        }
        
        const value = inputValue[0]; // toSingleton
        
        if (typeof value === 'boolean') {
          return [value];
        }
        
        if (typeof value === 'string') {
          const lower = value.toLowerCase();
          if (lower === 'true' || lower === 't' || lower === 'yes' || lower === 'y' || lower === '1') {
            return [true];
          }
          if (lower === 'false' || lower === 'f' || lower === 'no' || lower === 'n' || lower === '0') {
            return [false];
          }
        }
        
        if (typeof value === 'number') {
          if (value === 1) return [true];
          if (value === 0) return [false];
        }
        
        return [];
      },
      type: compiler.resolveType('Boolean'),
      isSingleton: true
    };
  }
};

export const toQuantityFunction: Function = {
  name: 'toQuantity',
  kind: 'function',
  
  syntax: {
    notation: 'toQuantity(unit)'
  },
  
  signature: {
    input: {
      types: { kind: 'union', types: ['Integer', 'Decimal', 'String'] },
      cardinality: 'singleton'
    },
    parameters: [
      {
        name: 'unit',
        kind: 'value',
        types: { kind: 'primitive', types: ['String'] },
        cardinality: 'singleton',
        optional: true
      }
    ],
    output: {
      type: 'Quantity',
      cardinality: 'singleton'
    },
    propagatesEmpty: true,
    deterministic: true
  },
  
  analyze: defaultFunctionAnalyze,
  
  evaluate: (interpreter, context, input, unit) => {
    if (input.length === 0) {
      return { value: [], context };
    }
    
    const value = CollectionUtils.toSingleton(input);
    
    if (typeof value === 'number') {
      const quantity = {
        value: value,
        unit: unit || '1',
        system: 'http://unitsofmeasure.org',
        code: unit || '1'
      };
      return { value: [quantity], context };
    }
    
    if (typeof value === 'string') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        const quantity = {
          value: num,
          unit: unit || '1',
          system: 'http://unitsofmeasure.org',
          code: unit || '1'
        };
        return { value: [quantity], context };
      }
    }
    
    return { value: [], context };
  },
  
  compile: defaultFunctionCompile
};