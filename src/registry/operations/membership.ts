import { TokenType } from '../../lexer/token';
import type { Operator } from '../types';
import { defaultOperatorAnalyze } from '../default-analyzers';
import type { Context, EvaluationResult } from '../../interpreter/types';
import type { CompiledExpression } from '../../compiler/types';

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
    parameters: [{ name: 'element' }, { name: 'collection' }],
    propagatesEmpty: false
  },
  analyze: defaultOperatorAnalyze,
  evaluate: (interpreter, context, input, element, collection) => {
    if (element.length === 0) return [false];
    if (collection.length === 0) return [false];
    return [isIn(element[0], collection)];
  },
  compile: (compiler, input, args) => {
    const [elemExpr, collExpr] = args;
    return {
      fn: (ctx: Context, inp: any[]): EvaluationResult => {
        const element = elemExpr.fn(ctx, inp);
        const collection = collExpr.fn(ctx, inp);
        if (element.length === 0) return [false];
        if (collection.length === 0) return [false];
        return [isIn(element[0], collection)];
      },
      source: `(${elemExpr.source || ''} in ${collExpr.source || ''})`
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
    parameters: [{ name: 'collection' }, { name: 'element' }],
    propagatesEmpty: false
  },
  analyze: defaultOperatorAnalyze,
  evaluate: (interpreter, context, input, collection, element) => {
    if (collection.length === 0) return [false];
    if (element.length === 0) return [false];
    return [isIn(element[0], collection)];
  },
  compile: (compiler, input, args) => {
    const [collExpr, elemExpr] = args;
    return {
      fn: (ctx: Context, inp: any[]): EvaluationResult => {
        const collection = collExpr.fn(ctx, inp);
        const element = elemExpr.fn(ctx, inp);
        if (collection.length === 0) return [false];
        if (element.length === 0) return [false];
        return [isIn(element[0], collection)];
      },
      source: `(${collExpr.source || ''} contains ${elemExpr.source || ''})`
    };
  }
};

// Export membership operators
export const membershipOperators = [
  inOperator,
  containsOperator
];