import { TokenType } from '../../lexer/token';
import type { Operator } from '../types';
import { defaultOperatorAnalyze } from '../default-analyzers';
import { toBoolean, toSingleton } from '../utils';

export const andOperator: Operator = {
  name: 'and',
  kind: 'operator',
  
  syntax: {
    form: 'infix',
    token: TokenType.AND,
    precedence: 3,
    associativity: 'left',
    notation: 'a and b'
  },
  
  signature: {
    parameters: [
      { name: 'left', types: { kind: 'any' }, cardinality: 'any' },
      { name: 'right', types: { kind: 'any' }, cardinality: 'any' }
    ],
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    },
    propagatesEmpty: false // Special three-valued logic
  },
  
  analyze: defaultOperatorAnalyze,
  
  evaluate: (interpreter, context, input, left, right) => {
    // Three-valued logic for and:
    // true and true = true
    // true and false = false
    // true and empty = empty
    // false and anything = false
    // empty and true = empty
    // empty and false = false
    // empty and empty = empty
    
    const leftEmpty = left.length === 0;
    const rightEmpty = right.length === 0;
    
    if (!leftEmpty) {
      const leftBool = toBoolean(toSingleton(left));
      if (!leftBool) {
        // false and anything = false
        return { value: [false], context };
      }
      // left is true
      if (rightEmpty) {
        // true and empty = empty
        return { value: [], context };
      }
      // true and right
      const rightBool = toBoolean(toSingleton(right));
      return { value: [rightBool], context };
    }
    
    // left is empty
    if (rightEmpty) {
      // empty and empty = empty
      return { value: [], context };
    }
    
    const rightBool = toBoolean(toSingleton(right));
    if (!rightBool) {
      // empty and false = false
      return { value: [false], context };
    }
    // empty and true = empty
    return { value: [], context };
  },
  
  compile: (compiler, input, args) => ({
    fn: (ctx) => {
      const left = args[0]?.fn(ctx) || [];
      const right = args[1]?.fn(ctx) || [];
      
      const leftEmpty = left.length === 0;
      const rightEmpty = right.length === 0;
      
      if (!leftEmpty) {
        const leftBool = toBoolean(toSingleton(left));
        if (!leftBool) return [false];
        if (rightEmpty) return [];
        return [toBoolean(toSingleton(right))];
      }
      
      if (rightEmpty) return [];
      const rightBool = toBoolean(toSingleton(right));
      if (!rightBool) return [false];
      return [];
    },
    type: compiler.resolveType('Boolean'),
    isSingleton: true,
    source: `${args[0]?.source || ''} and ${args[1]?.source || ''}`
  })
};

export const orOperator: Operator = {
  name: 'or',
  kind: 'operator',
  
  syntax: {
    form: 'infix',
    token: TokenType.OR,
    precedence: 2,
    associativity: 'left',
    notation: 'a or b'
  },
  
  signature: {
    parameters: [
      { name: 'left', types: { kind: 'any' }, cardinality: 'any' },
      { name: 'right', types: { kind: 'any' }, cardinality: 'any' }
    ],
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    },
    propagatesEmpty: false // Special three-valued logic
  },
  
  analyze: defaultOperatorAnalyze,
  
  evaluate: (interpreter, context, input, left, right) => {
    // Three-valued logic for or:
    // true or anything = true
    // false or true = true
    // false or false = false
    // false or empty = empty
    // empty or true = true
    // empty or false = empty
    // empty or empty = empty
    
    const leftEmpty = left.length === 0;
    const rightEmpty = right.length === 0;
    
    if (!leftEmpty) {
      const leftBool = toBoolean(toSingleton(left));
      if (leftBool) {
        // true or anything = true
        return { value: [true], context };
      }
      // left is false
      if (rightEmpty) {
        // false or empty = empty
        return { value: [], context };
      }
      // false or right
      const rightBool = toBoolean(toSingleton(right));
      return { value: [rightBool], context };
    }
    
    // left is empty
    if (rightEmpty) {
      // empty or empty = empty
      return { value: [], context };
    }
    
    const rightBool = toBoolean(toSingleton(right));
    if (rightBool) {
      // empty or true = true
      return { value: [true], context };
    }
    // empty or false = empty
    return { value: [], context };
  },
  
  compile: (compiler, input, args) => ({
    fn: (ctx) => {
      const left = args[0]?.fn(ctx) || [];
      const right = args[1]?.fn(ctx) || [];
      
      const leftEmpty = left.length === 0;
      const rightEmpty = right.length === 0;
      
      if (!leftEmpty) {
        const leftBool = toBoolean(toSingleton(left));
        if (leftBool) return [true];
        if (rightEmpty) return [];
        return [toBoolean(toSingleton(right))];
      }
      
      if (rightEmpty) return [];
      const rightBool = toBoolean(toSingleton(right));
      if (rightBool) return [true];
      return [];
    },
    type: compiler.resolveType('Boolean'),
    isSingleton: true,
    source: `${args[0]?.source || ''} or ${args[1]?.source || ''}`
  })
};

export const notOperator: Operator = {
  name: 'not',
  kind: 'operator',
  
  syntax: {
    form: 'prefix',
    token: TokenType.NOT,
    precedence: 10, // High precedence for unary operators
    notation: 'not a'
  },
  
  signature: {
    parameters: [
      { name: 'operand', types: { kind: 'any' }, cardinality: 'any' }
    ],
    output: {
      type: 'Boolean',
      cardinality: 'preserve-input'
    },
    propagatesEmpty: false // not empty = true
  },
  
  analyze: defaultOperatorAnalyze,
  
  evaluate: (interpreter, context, input, operand) => {
    if (operand.length === 0) {
      // not empty = true
      return { value: [true], context };
    }
    
    // Apply not to each element
    const result = operand.map((item: any) => !toBoolean(item));
    return { value: result, context };
  },
  
  compile: (compiler, input, args) => ({
    fn: (ctx) => {
      const operand = args[0]?.fn(ctx) || [];
      if (operand.length === 0) return [true];
      return operand.map((item: any) => !toBoolean(item));
    },
    type: compiler.resolveType('Boolean'),
    isSingleton: args[0]?.isSingleton ?? false,
    source: `not ${args[0]?.source || ''}`
  })
};

export const xorOperator: Operator = {
  name: 'xor',
  kind: 'operator',
  
  syntax: {
    form: 'infix',
    token: TokenType.XOR,
    precedence: 2,
    associativity: 'left',
    notation: 'a xor b'
  },
  
  signature: {
    parameters: [
      { name: 'left', types: { kind: 'any' }, cardinality: 'any' },
      { name: 'right', types: { kind: 'any' }, cardinality: 'any' }
    ],
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    },
    propagatesEmpty: true
  },
  
  analyze: defaultOperatorAnalyze,
  
  evaluate: (interpreter, context, input, left, right) => {
    if (left.length === 0 || right.length === 0) return { value: [], context };
    
    const leftBool = toBoolean(toSingleton(left));
    const rightBool = toBoolean(toSingleton(right));
    
    // XOR: true when exactly one is true
    return { value: [leftBool !== rightBool], context };
  },
  
  compile: (compiler, input, args) => ({
    fn: (ctx) => {
      const left = args[0]?.fn(ctx) || [];
      const right = args[1]?.fn(ctx) || [];
      
      if (left.length === 0 || right.length === 0) return [];
      
      const leftBool = toBoolean(toSingleton(left));
      const rightBool = toBoolean(toSingleton(right));
      
      return [leftBool !== rightBool];
    },
    type: compiler.resolveType('Boolean'),
    isSingleton: true,
    source: `${args[0]?.source || ''} xor ${args[1]?.source || ''}`
  })
};

export const impliesOperator: Operator = {
  name: 'implies',
  kind: 'operator',
  
  syntax: {
    form: 'infix',
    token: TokenType.IMPLIES,
    precedence: 1, // Lowest precedence
    associativity: 'left',
    notation: 'a implies b'
  },
  
  signature: {
    parameters: [
      { name: 'left', types: { kind: 'any' }, cardinality: 'any' },
      { name: 'right', types: { kind: 'any' }, cardinality: 'any' }
    ],
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    },
    propagatesEmpty: false // Special three-valued logic
  },
  
  analyze: defaultOperatorAnalyze,
  
  evaluate: (interpreter, context, input, left, right) => {
    // Implies truth table:
    // true implies true = true
    // true implies false = false
    // true implies empty = empty
    // false implies anything = true
    // empty implies true = true
    // empty implies false = empty
    // empty implies empty = empty
    
    const leftEmpty = left.length === 0;
    const rightEmpty = right.length === 0;
    
    if (!leftEmpty) {
      const leftBool = toBoolean(toSingleton(left));
      if (!leftBool) {
        // false implies anything = true
        return { value: [true], context };
      }
      // left is true
      if (rightEmpty) {
        // true implies empty = empty
        return { value: [], context };
      }
      // true implies right
      const rightBool = toBoolean(toSingleton(right));
      return { value: [rightBool], context };
    }
    
    // left is empty
    if (rightEmpty) {
      // empty implies empty = empty
      return { value: [], context };
    }
    
    const rightBool = toBoolean(toSingleton(right));
    if (rightBool) {
      // empty implies true = true
      return { value: [true], context };
    }
    // empty implies false = empty
    return { value: [], context };
  },
  
  compile: (compiler, input, args) => ({
    fn: (ctx) => {
      const left = args[0]?.fn(ctx) || [];
      const right = args[1]?.fn(ctx) || [];
      
      const leftEmpty = left.length === 0;
      const rightEmpty = right.length === 0;
      
      if (!leftEmpty) {
        const leftBool = toBoolean(toSingleton(left));
        if (!leftBool) return [true];
        if (rightEmpty) return [];
        return [toBoolean(toSingleton(right))];
      }
      
      if (rightEmpty) return [];
      const rightBool = toBoolean(toSingleton(right));
      if (rightBool) return [true];
      return [];
    },
    type: compiler.resolveType('Boolean'),
    isSingleton: true,
    source: `${args[0]?.source || ''} implies ${args[1]?.source || ''}`
  })
};

// Export all logical operators
export const logicalOperators = [
  andOperator,
  orOperator,
  notOperator,
  xorOperator,
  impliesOperator
];