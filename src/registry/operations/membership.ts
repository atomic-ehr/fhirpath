import { TokenType } from '../../lexer/token';
import type { Operator } from '../types';
import { defaultOperatorAnalyze } from '../default-analyzers';
import { defaultOperatorCompile } from '../default-compilers';

// Helper function to check if value is in collection
function isIn(value: any, collection: any[]): boolean {
  return collection.some(item => {
    if (value === item) return true;
    if (value == null || item == null) return false;
    
    // Handle complex equality
    if (typeof value === 'object' && typeof item === 'object') {
      return JSON.stringify(value) === JSON.stringify(item);
    }
    
    return false;
  });
}


export const inOperator: Operator = {
  name: 'in',
  kind: 'operator',
  syntax: {
    form: 'infix',
    token: TokenType.IN,
    precedence: 10,
    associativity: 'left',
    notation: 'a in b'
  },
  signature: {
    parameters: [{ name: 'left' }, { name: 'right' }],
    propagatesEmpty: false,
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    }
  },
  analyze: defaultOperatorAnalyze,
  evaluate: (_interpreter, context, _input, element, collection) => {
    if (element.length === 0 || collection.length === 0) return { value: [], context };
    
    // Handle string substring check
    if (collection.length === 1 && typeof collection[0] === 'string' && typeof element[0] === 'string') {
      return { value: [collection[0].includes(element[0])], context };
    }
    
    return { value: [isIn(element[0], collection)], context };
  },
  compile: (compiler, _input, args) => {
    const [leftExpr, rightExpr] = args;
    if (!leftExpr || !rightExpr) {
      throw new Error('in operator requires two arguments');
    }
    return {
      fn: (ctx) => {
        const left = leftExpr.fn(ctx);
        const right = rightExpr.fn(ctx);
        if (left.length === 0 || right.length === 0) return [];
        
        // Handle string substring check
        if (right.length === 1 && typeof right[0] === 'string' && typeof left[0] === 'string') {
          return [right[0].includes(left[0])];
        }
        
        return [isIn(left[0], right)];
      },
      type: compiler.resolveType('Boolean'),
      isSingleton: true
    };
  }
};

export const containsOperator: Operator = {
  name: 'contains',
  kind: 'operator',
  syntax: {
    form: 'infix',
    token: TokenType.CONTAINS,
    precedence: 10,
    associativity: 'left',
    notation: 'a contains b'
  },
  signature: {
    parameters: [{ name: 'left' }, { name: 'right' }],
    propagatesEmpty: false,
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    }
  },
  analyze: defaultOperatorAnalyze,
  evaluate: (_interpreter, context, _input, collection, element) => {
    if (collection.length === 0 || element.length === 0) return { value: [], context };
    
    // Handle string substring check
    if (collection.length === 1 && typeof collection[0] === 'string' && typeof element[0] === 'string') {
      return { value: [collection[0].includes(element[0])], context };
    }
    
    return { value: [isIn(element[0], collection)], context };
  },
  compile: (compiler, _input, args) => {
    const [leftExpr, rightExpr] = args;
    if (!leftExpr || !rightExpr) {
      throw new Error('contains operator requires two arguments');
    }
    return {
      fn: (ctx) => {
        const left = leftExpr.fn(ctx);
        const right = rightExpr.fn(ctx);
        if (left.length === 0 || right.length === 0) return [];
        
        // Handle string substring check
        if (left.length === 1 && typeof left[0] === 'string' && typeof right[0] === 'string') {
          return [left[0].includes(right[0])];
        }
        
        return [isIn(right[0], left)];
      },
      type: compiler.resolveType('Boolean'),
      isSingleton: true
    };
  }
};

// Export membership operators
export const membershipOperators = [
  inOperator,
  containsOperator
];