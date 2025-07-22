import type { Literal } from '../types';
import { defaultLiteralAnalyze } from '../default-analyzers';

export const integerLiteral: Literal = {
  name: 'integer-literal',
  kind: 'literal',
  
  syntax: {
    pattern: /^-?\d+$/,
    notation: '123'
  },
  
  signature: {
    output: {
      type: 'Integer',
      cardinality: 'singleton'
    }
  },
  
  parse: (value: string) => parseInt(value, 10),
  
  analyze: defaultLiteralAnalyze,
  
  evaluate: (interpreter, context, input, ...args) => {
    // Value is passed as first argument from parser
    const value = args[0];
    return { value: [value], context };
  },
  
  compile: (compiler, input, args) => {
    // Value is captured from parser
    const value = (input as any).value || 0; // Parser stores parsed value
    return {
      fn: (ctx) => [value],
      type: compiler.resolveType('Integer'),
      isSingleton: true,
      source: value.toString()
    };
  }
};

export const decimalLiteral: Literal = {
  name: 'decimal-literal',
  kind: 'literal',
  
  syntax: {
    pattern: /^-?\d+\.\d+$/,
    notation: '123.45'
  },
  
  signature: {
    output: {
      type: 'Decimal',
      cardinality: 'singleton'
    }
  },
  
  parse: (value: string) => parseFloat(value),
  
  analyze: defaultLiteralAnalyze,
  
  evaluate: (interpreter, context, input, ...args) => {
    const value = args[0];
    return { value: [value], context };
  },
  
  compile: (compiler, input, args) => {
    const value = (input as any).value || 0.0;
    return {
      fn: (ctx) => [value],
      type: compiler.resolveType('Decimal'),
      isSingleton: true,
      source: value.toString()
    };
  }
};

export const trueLiteral: Literal = {
  name: 'true',
  kind: 'literal',
  
  syntax: {
    keywords: ['true'],
    notation: 'true'
  },
  
  signature: {
    output: { 
      type: 'Boolean', 
      cardinality: 'singleton' 
    }
  },
  
  parse: () => true,
  
  analyze: defaultLiteralAnalyze,
  
  evaluate: (interpreter, context) => ({ value: [true], context }),
  
  compile: (compiler) => ({
    fn: (ctx) => [true],
    type: compiler.resolveType('Boolean'),
    isSingleton: true,
    source: 'true'
  })
};

export const falseLiteral: Literal = {
  name: 'false',
  kind: 'literal',
  
  syntax: {
    keywords: ['false'],
    notation: 'false'
  },
  
  signature: {
    output: { 
      type: 'Boolean', 
      cardinality: 'singleton' 
    }
  },
  
  parse: () => false,
  
  analyze: defaultLiteralAnalyze,
  
  evaluate: (interpreter, context) => ({ value: [false], context }),
  
  compile: (compiler) => ({
    fn: (ctx) => [false],
    type: compiler.resolveType('Boolean'),
    isSingleton: true,
    source: 'false'
  })
};

export const stringLiteral: Literal = {
  name: 'string-literal',
  kind: 'literal',
  
  syntax: {
    pattern: /^'([^'\\]|\\.)*'$/,
    notation: "'hello'"
  },
  
  signature: {
    output: {
      type: 'String',
      cardinality: 'singleton'
    }
  },
  
  parse: (value: string) => {
    // Remove quotes and unescape
    const content = value.slice(1, -1);
    return content
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, "\\")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\f/g, "\f")
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  },
  
  analyze: defaultLiteralAnalyze,
  
  evaluate: (interpreter, context, input, ...args) => {
    const value = args[0];
    return { value: [value], context };
  },
  
  compile: (compiler, input, args) => {
    const value = (input as any).value || '';
    return {
      fn: (ctx) => [value],
      type: compiler.resolveType('String'),
      isSingleton: true,
      source: `'${value.replace(/'/g, "\\'")}'`
    };
  }
};

export const dateTimeLiteral: Literal = {
  name: 'datetime-literal',
  kind: 'literal',
  
  syntax: {
    pattern: /@\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?)?)?/,
    notation: '@2023-01-01T12:00:00Z'
  },
  
  signature: {
    output: { 
      type: 'DateTime', 
      cardinality: 'singleton' 
    }
  },
  
  parse: (value: string) => {
    // Remove @ prefix
    const dateStr = value.substring(1);
    
    // Parse partial dates by padding with defaults
    const parts = dateStr.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:\d{2})?)?)?)?$/);
    if (!parts) throw new Error(`Invalid DateTime literal: ${value}`);
    
    const [, year, month = '01', day = '01', hour = '00', minute = '00', second = '00', ms = '0', tz = ''] = parts;
    
    const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}.${ms.padEnd(3, '0')}${tz || 'Z'}`;
    return new Date(isoString);
  },
  
  analyze: defaultLiteralAnalyze,
  
  evaluate: (interpreter, context, input, ...args) => {
    const value = args[0];
    return { value: [value], context };
  },
  
  compile: (compiler, input, args) => {
    const value = (input as any).value || new Date();
    return {
      fn: (ctx) => [value],
      type: compiler.resolveType('DateTime'),
      isSingleton: true,
      source: `@${value.toISOString()}`
    };
  }
};

export const timeLiteral: Literal = {
  name: 'time-literal',
  kind: 'literal',
  
  syntax: {
    pattern: /@T\d{2}:\d{2}(:\d{2}(\.\d+)?)?/,
    notation: '@T12:00:00'
  },
  
  signature: {
    output: { 
      type: 'Time', 
      cardinality: 'singleton' 
    }
  },
  
  parse: (value: string) => {
    // Remove @T prefix
    const timeStr = value.substring(2);
    
    // Parse time components
    const parts = timeStr.match(/^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/);
    if (!parts) throw new Error(`Invalid Time literal: ${value}`);
    
    const [, hour, minute, second = '00', ms = '0'] = parts as string[];
    
    // Store as object with time components
    return {
      hour: parseInt(hour || '0', 10),
      minute: parseInt(minute || '0', 10),
      second: parseInt(second || '0', 10),
      millisecond: parseInt(ms.padEnd(3, '0'), 10)
    };
  },
  
  analyze: defaultLiteralAnalyze,
  
  evaluate: (interpreter, context, input, ...args) => {
    const value = args[0];
    return { value: [value], context };
  },
  
  compile: (compiler, input, args) => {
    const value = (input as any).value || { hour: 0, minute: 0, second: 0 };
    return {
      fn: (ctx) => [value],
      type: compiler.resolveType('Time'),
      isSingleton: true,
      source: `@T${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}:${String(value.second).padStart(2, '0')}`
    };
  }
};

export const quantityLiteral: Literal = {
  name: 'quantity-literal',
  kind: 'literal',
  
  syntax: {
    pattern: /^-?\d+(\.\d+)?\s*'[^']+'$/,
    notation: "5.4 'mg'"
  },
  
  signature: {
    output: {
      type: 'Quantity',
      cardinality: 'singleton'
    }
  },
  
  parse: (value: string) => {
    const match = value.match(/^(-?\d+(?:\.\d+)?)\s*'([^']+)'$/);
    if (!match) throw new Error(`Invalid Quantity literal: ${value}`);
    
    const [, num, unit] = match as [string, string, string];
    return {
      value: parseFloat(num || '0'),
      unit: unit || ''
    };
  },
  
  analyze: defaultLiteralAnalyze,
  
  evaluate: (interpreter, context, input, ...args) => {
    const value = args[0];
    return { value: [value], context };
  },
  
  compile: (compiler, input, args) => {
    const value = (input as any).value || { value: 0, unit: '' };
    return {
      fn: (ctx) => [value],
      type: compiler.resolveType('Quantity'),
      isSingleton: true,
      source: `${value.value} '${value.unit}'`
    };
  }
};

// Export all literals
export const literals = [
  integerLiteral,
  decimalLiteral,
  trueLiteral,
  falseLiteral,
  stringLiteral,
  dateTimeLiteral,
  timeLiteral,
  quantityLiteral
];