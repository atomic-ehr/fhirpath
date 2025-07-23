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
    propagatesEmpty: false
  },
  analyze: defaultOperatorAnalyze,
  evaluate: (interpreter, context, input, element, collection) => {
    if (element.length === 0) return { value: [false], context };
    if (collection.length === 0) return { value: [false], context };
    return { value: [isIn(element[0], collection)], context };
  },
  compile: (compiler, input, args) => {
    const [leftExpr, rightExpr] = args;
    return {
      fn: (ctx) => {
        const left = leftExpr.fn(ctx);
        const right = rightExpr.fn(ctx);
        if (left.length === 0) return [false];
        if (right.length === 0) return [false];
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
    propagatesEmpty: false
  },
  analyze: defaultOperatorAnalyze,
  evaluate: (interpreter, context, input, collection, element) => {
    if (collection.length === 0) return { value: [false], context };
    if (element.length === 0) return { value: [false], context };
    return { value: [isIn(element[0], collection)], context };
  },
  compile: (compiler, input, args) => {
    const [leftExpr, rightExpr] = args;
    return {
      fn: (ctx) => {
        const left = leftExpr.fn(ctx);
        const right = rightExpr.fn(ctx);
        if (left.length === 0) return [false];
        if (right.length === 0) return [false];
        return [isIn(left[0], right)];
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