import { TokenType } from '../../lexer/token';
import type { Operator } from '../types';
import { defaultOperatorAnalyze } from '../default-analyzers';
import { defaultOperatorCompile } from '../default-compilers';

// Helper function for equality comparison
function isEqual(left: any, right: any): boolean {
  if (left === right) return true;
  if (left == null || right == null) return false;
  
  // Array comparison
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false;
    return left.every((v, i) => isEqual(v, right[i]));
  }
  
  // Object comparison (for complex types)
  if (typeof left === 'object' && typeof right === 'object') {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every(key => isEqual(left[key], right[key]));
  }
  
  return false;
}

// Comparison operators
export const eqOperator: Operator = {
  name: '=',
  kind: 'operator',
  syntax: {
    form: 'infix',
    token: TokenType.EQ,
    precedence: 9,
    associativity: 'left',
    notation: 'a = b'
  },
  signature: {
    parameters: [{ name: 'left' }, { name: 'right' }],
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    },
    propagatesEmpty: false
  },
  analyze: defaultOperatorAnalyze,
  evaluate: (interpreter, context, input, left, right) => {
    if (left.length === 0 || right.length === 0) return { value: [], context };
    
    // FHIRPath equality compares entire collections if both have multiple items
    if (left.length > 1 || right.length > 1) {
      // Collection equality
      return { value: [isEqual(left, right)], context };
    }
    
    // Singleton comparison
    return { value: [isEqual(left[0], right[0])], context };
  },
  compile: (compiler, input, args) => {
    const [leftExpr, rightExpr] = args;
    return {
      fn: (ctx) => {
        const left = leftExpr.fn(ctx);
        const right = rightExpr.fn(ctx);
        if (left.length === 0 || right.length === 0) return [];
        
        // FHIRPath equality compares entire collections if both have multiple items
        if (left.length > 1 || right.length > 1) {
          return [isEqual(left, right)];
        }
        
        return [isEqual(left[0], right[0])];
      },
      type: compiler.resolveType('Boolean'),
      isSingleton: true
    };
  }
};

export const neqOperator: Operator = {
  name: '!=',
  kind: 'operator',
  syntax: {
    form: 'infix',
    token: TokenType.NEQ,
    precedence: 9,
    associativity: 'left',
    notation: 'a != b'
  },
  signature: {
    parameters: [{ name: 'left' }, { name: 'right' }],
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    },
    propagatesEmpty: false
  },
  analyze: defaultOperatorAnalyze,
  evaluate: (interpreter, context, input, left, right) => {
    if (left.length === 0 || right.length === 0) return { value: [], context };
    
    // FHIRPath inequality compares entire collections if both have multiple items
    if (left.length > 1 || right.length > 1) {
      return { value: [!isEqual(left, right)], context };
    }
    
    return { value: [!isEqual(left[0], right[0])], context };
  },
  compile: (compiler, input, args) => {
    const [leftExpr, rightExpr] = args;
    return {
      fn: (ctx) => {
        const left = leftExpr.fn(ctx);
        const right = rightExpr.fn(ctx);
        if (left.length === 0 || right.length === 0) return [];
        
        // FHIRPath inequality compares entire collections if both have multiple items
        if (left.length > 1 || right.length > 1) {
          return [!isEqual(left, right)];
        }
        
        return [!isEqual(left[0], right[0])];
      },
      type: compiler.resolveType('Boolean'),
      isSingleton: true
    };
  }
};

export const ltOperator: Operator = {
  name: '<',
  kind: 'operator',
  syntax: {
    form: 'infix',
    token: TokenType.LT,
    precedence: 8,
    associativity: 'left',
    notation: 'a < b'
  },
  signature: {
    parameters: [{ name: 'left' }, { name: 'right' }],
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    },
    propagatesEmpty: false
  },
  analyze: defaultOperatorAnalyze,
  evaluate: (interpreter, context, input, left, right) => {
    if (left.length === 0 || right.length === 0) return { value: [], context };
    const l = left[0];
    const r = right[0];
    if (typeof l === 'number' && typeof r === 'number') return { value: [l < r], context };
    if (typeof l === 'string' && typeof r === 'string') return { value: [l < r], context };
    if (l instanceof Date && r instanceof Date) return { value: [l < r], context };
    return { value: [], context };
  },
  compile: (compiler, input, args) => {
    const [leftExpr, rightExpr] = args;
    return {
      fn: (ctx) => {
        const left = leftExpr.fn(ctx);
        const right = rightExpr.fn(ctx);
        if (left.length === 0 || right.length === 0) return [];
        const l = left[0];
        const r = right[0];
        if (typeof l === 'number' && typeof r === 'number') return [l < r];
        if (typeof l === 'string' && typeof r === 'string') return [l < r];
        if (l instanceof Date && r instanceof Date) return [l < r];
        return [];
      },
      type: compiler.resolveType('Boolean'),
      isSingleton: true
    };
  }
};

export const gtOperator: Operator = {
  name: '>',
  kind: 'operator',
  syntax: {
    form: 'infix',
    token: TokenType.GT,
    precedence: 8,
    associativity: 'left',
    notation: 'a > b'
  },
  signature: {
    parameters: [{ name: 'left' }, { name: 'right' }],
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    },
    propagatesEmpty: false
  },
  analyze: defaultOperatorAnalyze,
  evaluate: (interpreter, context, input, left, right) => {
    if (left.length === 0 || right.length === 0) return { value: [], context };
    const l = left[0];
    const r = right[0];
    if (typeof l === 'number' && typeof r === 'number') return { value: [l > r], context };
    if (typeof l === 'string' && typeof r === 'string') return { value: [l > r], context };
    if (l instanceof Date && r instanceof Date) return { value: [l > r], context };
    return { value: [], context };
  },
  compile: (compiler, input, args) => {
    const [leftExpr, rightExpr] = args;
    return {
      fn: (ctx) => {
        const left = leftExpr.fn(ctx);
        const right = rightExpr.fn(ctx);
        if (left.length === 0 || right.length === 0) return [];
        const l = left[0];
        const r = right[0];
        if (typeof l === 'number' && typeof r === 'number') return [l > r];
        if (typeof l === 'string' && typeof r === 'string') return [l > r];
        if (l instanceof Date && r instanceof Date) return [l > r];
        return [];
      },
      type: compiler.resolveType('Boolean'),
      isSingleton: true
    };
  }
};

export const lteOperator: Operator = {
  name: '<=',
  kind: 'operator',
  syntax: {
    form: 'infix',
    token: TokenType.LTE,
    precedence: 8,
    associativity: 'left',
    notation: 'a <= b'
  },
  signature: {
    parameters: [{ name: 'left' }, { name: 'right' }],
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    },
    propagatesEmpty: false
  },
  analyze: defaultOperatorAnalyze,
  evaluate: (interpreter, context, input, left, right) => {
    if (left.length === 0 || right.length === 0) return { value: [], context };
    const l = left[0];
    const r = right[0];
    if (typeof l === 'number' && typeof r === 'number') return { value: [l <= r], context };
    if (typeof l === 'string' && typeof r === 'string') return { value: [l <= r], context };
    if (l instanceof Date && r instanceof Date) return { value: [l <= r], context };
    return { value: [], context };
  },
  compile: (compiler, input, args) => {
    const [leftExpr, rightExpr] = args;
    return {
      fn: (ctx) => {
        const left = leftExpr.fn(ctx);
        const right = rightExpr.fn(ctx);
        if (left.length === 0 || right.length === 0) return [];
        const l = left[0];
        const r = right[0];
        if (typeof l === 'number' && typeof r === 'number') return [l <= r];
        if (typeof l === 'string' && typeof r === 'string') return [l <= r];
        if (l instanceof Date && r instanceof Date) return [l <= r];
        return [];
      },
      type: compiler.resolveType('Boolean'),
      isSingleton: true
    };
  }
};

export const gteOperator: Operator = {
  name: '>=',
  kind: 'operator',
  syntax: {
    form: 'infix',
    token: TokenType.GTE,
    precedence: 8,
    associativity: 'left',
    notation: 'a >= b'
  },
  signature: {
    parameters: [{ name: 'left' }, { name: 'right' }],
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    },
    propagatesEmpty: false
  },
  analyze: defaultOperatorAnalyze,
  evaluate: (interpreter, context, input, left, right) => {
    if (left.length === 0 || right.length === 0) return { value: [], context };
    const l = left[0];
    const r = right[0];
    if (typeof l === 'number' && typeof r === 'number') return { value: [l >= r], context };
    if (typeof l === 'string' && typeof r === 'string') return { value: [l >= r], context };
    if (l instanceof Date && r instanceof Date) return { value: [l >= r], context };
    return { value: [], context };
  },
  compile: (compiler, input, args) => {
    const [leftExpr, rightExpr] = args;
    return {
      fn: (ctx) => {
        const left = leftExpr.fn(ctx);
        const right = rightExpr.fn(ctx);
        if (left.length === 0 || right.length === 0) return [];
        const l = left[0];
        const r = right[0];
        if (typeof l === 'number' && typeof r === 'number') return [l >= r];
        if (typeof l === 'string' && typeof r === 'string') return [l >= r];
        if (l instanceof Date && r instanceof Date) return [l >= r];
        return [];
      },
      type: compiler.resolveType('Boolean'),
      isSingleton: true
    };
  }
};

export const equivOperator: Operator = {
  name: '~',
  kind: 'operator',
  syntax: {
    form: 'infix',
    token: TokenType.EQUIV,
    precedence: 9,
    associativity: 'left',
    notation: 'a ~ b'
  },
  signature: {
    parameters: [{ name: 'left' }, { name: 'right' }],
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    },
    propagatesEmpty: false
  },
  analyze: defaultOperatorAnalyze,
  evaluate: (interpreter, context, input, left, right) => {
    if (left.length === 0 || right.length === 0) return { value: [], context };
    // Equivalence is more lenient than equality
    const l = left[0];
    const r = right[0];
    if (l == null && r == null) return { value: [true], context };
    if (l == null || r == null) return { value: [false], context };
    // For strings, case-insensitive comparison
    if (typeof l === 'string' && typeof r === 'string') {
      return { value: [l.toLowerCase() === r.toLowerCase()], context };
    }
    return { value: [isEqual(l, r)], context };
  },
  compile: (compiler, input, args) => {
    const [leftExpr, rightExpr] = args;
    return {
      fn: (ctx) => {
        const left = leftExpr.fn(ctx);
        const right = rightExpr.fn(ctx);
        if (left.length === 0 || right.length === 0) return [];
        const l = left[0];
        const r = right[0];
        if (l == null && r == null) return [true];
        if (l == null || r == null) return [false];
        if (typeof l === 'string' && typeof r === 'string') {
          return [l.toLowerCase() === r.toLowerCase()];
        }
        return [isEqual(l, r)];
      },
      type: compiler.resolveType('Boolean'),
      isSingleton: true
    };
  }
};

export const nequivOperator: Operator = {
  name: '!~',
  kind: 'operator',
  syntax: {
    form: 'infix',
    token: TokenType.NEQUIV,
    precedence: 9,
    associativity: 'left',
    notation: 'a !~ b'
  },
  signature: {
    parameters: [{ name: 'left' }, { name: 'right' }],
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    },
    propagatesEmpty: false
  },
  analyze: defaultOperatorAnalyze,
  evaluate: (interpreter, context, input, left, right) => {
    const equivResult = equivOperator.evaluate(interpreter, context, input, left, right);
    return equivResult.value.length > 0 ? { value: [!equivResult.value[0]], context } : { value: [], context };
  },
  compile: (compiler, input, args) => {
    const [leftExpr, rightExpr] = args;
    return {
      fn: (ctx) => {
        const left = leftExpr.fn(ctx);
        const right = rightExpr.fn(ctx);
        if (left.length === 0 || right.length === 0) return [];
        const l = left[0];
        const r = right[0];
        if (l == null && r == null) return [false];
        if (l == null || r == null) return [true];
        if (typeof l === 'string' && typeof r === 'string') {
          return [l.toLowerCase() !== r.toLowerCase()];
        }
        return [!isEqual(l, r)];
      },
      type: compiler.resolveType('Boolean'),
      isSingleton: true
    };
  }
};

// Export all comparison operators
export const comparisonOperators = [
  eqOperator,
  neqOperator,
  ltOperator,
  gtOperator,
  lteOperator,
  gteOperator,
  equivOperator,
  nequivOperator
];