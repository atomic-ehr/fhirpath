import { TokenType } from '../../lexer/token';
import type { Operator, TypeRef } from '../types';
import { defaultOperatorAnalyze } from '../default-analyzers';
import { toSingleton } from '../utils';

// Helper to promote numeric types
function promoteNumericType(left: TypeRef, right: TypeRef): TypeRef {
  const leftName = typeof left === 'string' ? left : (left as any).name;
  const rightName = typeof right === 'string' ? right : (right as any).name;
  
  if (leftName === 'Decimal' || rightName === 'Decimal') return 'Decimal';
  if (leftName === 'Integer' && rightName === 'Integer') return 'Integer';
  return 'Decimal'; // Default to Decimal for safety
}

export const plusOperator: Operator = {
  name: '+',
  kind: 'operator',
  
  syntax: {
    form: 'infix',
    token: TokenType.PLUS,
    precedence: 5,
    associativity: 'left',
    notation: 'a + b'
  },
  
  signature: {
    parameters: [
      { name: 'left', types: { kind: 'union', types: ['Integer', 'Decimal', 'String', 'Date', 'DateTime', 'Time'] }, cardinality: 'singleton' },
      { name: 'right', types: { kind: 'union', types: ['Integer', 'Decimal', 'String', 'Quantity'] }, cardinality: 'singleton' }
    ],
    output: {
      type: 'promote-numeric',
      cardinality: 'singleton'
    },
    propagatesEmpty: true
  },
  
  analyze: function(analyzer, input, args) {
    // First run default validation
    const result = defaultOperatorAnalyze.call(this, analyzer, input, args);
    
    // Additional validation: both operands should be same "category" (numeric vs string)
    const leftType = args[0].type;
    const rightType = args[1].type;
    
    const leftTypeName = typeof leftType === 'string' ? leftType : (leftType as any).type || (leftType as any).name || 'unknown';
    const rightTypeName = typeof rightType === 'string' ? rightType : (rightType as any).type || (rightType as any).name || 'unknown';
    
    const isLeftString = leftTypeName === 'String' || leftTypeName === 'string';
    const isRightString = rightTypeName === 'String' || rightTypeName === 'string';
    const isLeftNumeric = ['Integer', 'Decimal', 'integer', 'decimal'].includes(leftTypeName);
    const isRightNumeric = ['Integer', 'Decimal', 'integer', 'decimal'].includes(rightTypeName);
    
    // If one is string and other is numeric, that's an error
    if ((isLeftString && isRightNumeric) || (isLeftNumeric && isRightString)) {
      analyzer.error(`Operator '+' cannot be applied to types ${leftTypeName} and ${rightTypeName}`);
    }
    
    return result;
  },
  
  evaluate: (interpreter, context, input, left, right) => {
    if (left.length === 0 || right.length === 0) return { value: [], context };
    
    const l = toSingleton(left);
    const r = toSingleton(right);
    
    // String concatenation
    if (typeof l === 'string' || typeof r === 'string') {
      return { value: [String(l) + String(r)], context };
    }
    
    // Numeric addition
    return { value: [l + r], context };
  },
  
  compile: (compiler, input, args) => ({
    fn: (ctx) => {
      const left = args[0].fn(ctx);
      const right = args[1].fn(ctx);
      if (left.length === 0 || right.length === 0) return [];
      
      const l = toSingleton(left);
      const r = toSingleton(right);
      
      if (typeof l === 'string' || typeof r === 'string') {
        return [String(l) + String(r)];
      }
      
      return [l + r];
    },
    type: promoteNumericType(args[0].type, args[1].type),
    isSingleton: true,
    source: `${args[0].source || ''} + ${args[1].source || ''}`
  })
};

export const minusOperator: Operator = {
  name: '-',
  kind: 'operator',
  
  syntax: {
    form: 'infix',
    token: TokenType.MINUS,
    precedence: 5,
    associativity: 'left',
    notation: 'a - b'
  },
  
  signature: {
    parameters: [
      { name: 'left', types: { kind: 'union', types: ['Integer', 'Decimal', 'Date', 'DateTime', 'Time'] }, cardinality: 'singleton' },
      { name: 'right', types: { kind: 'union', types: ['Integer', 'Decimal', 'Quantity'] }, cardinality: 'singleton' }
    ],
    output: {
      type: 'promote-numeric',
      cardinality: 'singleton'
    },
    propagatesEmpty: true
  },
  
  analyze: defaultOperatorAnalyze,
  
  evaluate: (interpreter, context, input, left, right) => {
    if (left.length === 0 || right.length === 0) return { value: [], context };
    
    const l = toSingleton(left);
    const r = toSingleton(right);
    
    return { value: [l - r], context };
  },
  
  compile: (compiler, input, args) => ({
    fn: (ctx) => {
      const left = args[0].fn(ctx);
      const right = args[1].fn(ctx);
      if (left.length === 0 || right.length === 0) return [];
      
      return [toSingleton(left) - toSingleton(right)];
    },
    type: promoteNumericType(args[0].type, args[1].type),
    isSingleton: true,
    source: `${args[0].source || ''} - ${args[1].source || ''}`
  })
};

export const multiplyOperator: Operator = {
  name: '*',
  kind: 'operator',
  
  syntax: {
    form: 'infix',
    token: TokenType.STAR,
    precedence: 6,
    associativity: 'left',
    notation: 'a * b'
  },
  
  signature: {
    parameters: [
      { name: 'left', types: { kind: 'union', types: ['Integer', 'Decimal'] }, cardinality: 'singleton' },
      { name: 'right', types: { kind: 'union', types: ['Integer', 'Decimal'] }, cardinality: 'singleton' }
    ],
    output: {
      type: 'promote-numeric',
      cardinality: 'singleton'
    },
    propagatesEmpty: true
  },
  
  analyze: defaultOperatorAnalyze,
  
  evaluate: (interpreter, context, input, left, right) => {
    if (left.length === 0 || right.length === 0) return { value: [], context };
    
    const l = toSingleton(left);
    const r = toSingleton(right);
    
    return { value: [l * r], context };
  },
  
  compile: (compiler, input, args) => ({
    fn: (ctx) => {
      const left = args[0].fn(ctx);
      const right = args[1].fn(ctx);
      if (left.length === 0 || right.length === 0) return [];
      
      return [toSingleton(left) * toSingleton(right)];
    },
    type: promoteNumericType(args[0].type, args[1].type),
    isSingleton: true,
    source: `${args[0].source || ''} * ${args[1].source || ''}`
  })
};

export const divideOperator: Operator = {
  name: '/',
  kind: 'operator',
  
  syntax: {
    form: 'infix',
    token: TokenType.SLASH,
    precedence: 6,
    associativity: 'left',
    notation: 'a / b'
  },
  
  signature: {
    parameters: [
      { name: 'left', types: { kind: 'union', types: ['Integer', 'Decimal'] }, cardinality: 'singleton' },
      { name: 'right', types: { kind: 'union', types: ['Integer', 'Decimal'] }, cardinality: 'singleton' }
    ],
    output: {
      type: 'Decimal', // Division always returns Decimal
      cardinality: 'singleton'
    },
    propagatesEmpty: true
  },
  
  analyze: defaultOperatorAnalyze,
  
  evaluate: (interpreter, context, input, left, right) => {
    if (left.length === 0 || right.length === 0) return { value: [], context };
    
    const l = toSingleton(left);
    const r = toSingleton(right);
    
    if (r === 0) return { value: [], context }; // Division by zero returns empty
    
    return { value: [l / r], context };
  },
  
  compile: (compiler, input, args) => ({
    fn: (ctx) => {
      const left = args[0].fn(ctx);
      const right = args[1].fn(ctx);
      if (left.length === 0 || right.length === 0) return [];
      
      const r = toSingleton(right);
      if (r === 0) return [];
      
      return [toSingleton(left) / r];
    },
    type: compiler.resolveType('Decimal'),
    isSingleton: true,
    source: `${args[0].source || ''} / ${args[1].source || ''}`
  })
};

export const modOperator: Operator = {
  name: 'mod',
  kind: 'operator',
  
  syntax: {
    form: 'infix',
    token: TokenType.MOD,
    precedence: 6,
    associativity: 'left',
    notation: 'a mod b'
  },
  
  signature: {
    parameters: [
      { name: 'left', types: { kind: 'union', types: ['Integer', 'Decimal'] }, cardinality: 'singleton' },
      { name: 'right', types: { kind: 'union', types: ['Integer', 'Decimal'] }, cardinality: 'singleton' }
    ],
    output: {
      type: 'promote-numeric',
      cardinality: 'singleton'
    },
    propagatesEmpty: true
  },
  
  analyze: defaultOperatorAnalyze,
  
  evaluate: (interpreter, context, input, left, right) => {
    if (left.length === 0 || right.length === 0) return { value: [], context };
    
    const l = toSingleton(left);
    const r = toSingleton(right);
    
    if (r === 0) return { value: [], context }; // Modulo by zero returns empty
    
    return { value: [l % r], context };
  },
  
  compile: (compiler, input, args) => ({
    fn: (ctx) => {
      const left = args[0].fn(ctx);
      const right = args[1].fn(ctx);
      if (left.length === 0 || right.length === 0) return [];
      
      const r = toSingleton(right);
      if (r === 0) return [];
      
      return [toSingleton(left) % r];
    },
    type: promoteNumericType(args[0].type, args[1].type),
    isSingleton: true,
    source: `${args[0].source || ''} mod ${args[1].source || ''}`
  })
};

export const divOperator: Operator = {
  name: 'div',
  kind: 'operator',
  
  syntax: {
    form: 'infix',
    token: TokenType.DIV,
    precedence: 6,
    associativity: 'left',
    notation: 'a div b'
  },
  
  signature: {
    parameters: [
      { name: 'left', types: { kind: 'union', types: ['Integer', 'Decimal'] }, cardinality: 'singleton' },
      { name: 'right', types: { kind: 'union', types: ['Integer', 'Decimal'] }, cardinality: 'singleton' }
    ],
    output: {
      type: 'Integer', // Integer division
      cardinality: 'singleton'
    },
    propagatesEmpty: true
  },
  
  analyze: defaultOperatorAnalyze,
  
  evaluate: (interpreter, context, input, left, right) => {
    if (left.length === 0 || right.length === 0) return { value: [], context };
    
    const l = toSingleton(left);
    const r = toSingleton(right);
    
    if (r === 0) return { value: [], context }; // Division by zero returns empty
    
    return { value: [Math.floor(l / r)], context };
  },
  
  compile: (compiler, input, args) => ({
    fn: (ctx) => {
      const left = args[0].fn(ctx);
      const right = args[1].fn(ctx);
      if (left.length === 0 || right.length === 0) return [];
      
      const r = toSingleton(right);
      if (r === 0) return [];
      
      return [Math.floor(toSingleton(left) / r)];
    },
    type: compiler.resolveType('Integer'),
    isSingleton: true,
    source: `${args[0].source || ''} div ${args[1].source || ''}`
  })
};

export const unaryPlusOperator: Operator = {
  name: 'unary+',
  kind: 'operator',
  
  syntax: {
    form: 'prefix',
    token: TokenType.PLUS,
    precedence: 10, // High precedence for unary operators
    notation: '+a'
  },
  
  signature: {
    parameters: [
      { name: 'operand', types: { kind: 'union', types: ['Integer', 'Decimal'] }, cardinality: 'singleton' }
    ],
    output: {
      type: 'preserve-input',
      cardinality: 'singleton'
    },
    propagatesEmpty: true
  },
  
  analyze: defaultOperatorAnalyze,
  
  evaluate: (interpreter, context, input, operand) => {
    if (operand.length === 0) return { value: [], context };
    return { value: operand, context }; // Unary plus is identity
  },
  
  compile: (compiler, input, args) => ({
    fn: (ctx) => args[0].fn(ctx),
    type: args[0].type,
    isSingleton: true,
    source: `+${args[0].source || ''}`
  })
};

export const unaryMinusOperator: Operator = {
  name: 'unary-',
  kind: 'operator',
  
  syntax: {
    form: 'prefix',
    token: TokenType.MINUS,
    precedence: 10, // High precedence for unary operators
    notation: '-a'
  },
  
  signature: {
    parameters: [
      { name: 'operand', types: { kind: 'union', types: ['Integer', 'Decimal'] }, cardinality: 'singleton' }
    ],
    output: {
      type: 'preserve-input',
      cardinality: 'singleton'
    },
    propagatesEmpty: true
  },
  
  analyze: defaultOperatorAnalyze,
  
  evaluate: (interpreter, context, input, operand) => {
    if (operand.length === 0) return { value: [], context };
    
    const val = toSingleton(operand);
    return { value: [-val], context };
  },
  
  compile: (compiler, input, args) => ({
    fn: (ctx) => {
      const operand = args[0].fn(ctx);
      if (operand.length === 0) return [];
      return [-toSingleton(operand)];
    },
    type: args[0].type,
    isSingleton: true,
    source: `-${args[0].source || ''}`
  })
};

export const concatOperator: Operator = {
  name: '&',
  kind: 'operator',
  
  syntax: {
    form: 'infix',
    token: TokenType.CONCAT,
    precedence: 5,
    associativity: 'left',
    notation: 'a & b'
  },
  
  signature: {
    parameters: [
      { name: 'left', types: { kind: 'primitive', types: ['String'] }, cardinality: 'singleton' },
      { name: 'right', types: { kind: 'primitive', types: ['String'] }, cardinality: 'singleton' }
    ],
    output: {
      type: 'String',
      cardinality: 'singleton'
    },
    propagatesEmpty: true
  },
  
  analyze: defaultOperatorAnalyze,
  
  evaluate: (interpreter, context, input, left, right) => {
    if (left.length === 0 || right.length === 0) return { value: [], context };
    
    // String concatenation requires both operands to be singletons
    if (left.length > 1 || right.length > 1) return { value: [], context };
    
    const l = left[0];
    const r = right[0];
    
    return { value: [String(l) + String(r)], context };
  },
  
  compile: (compiler, input, args) => ({
    fn: (ctx) => {
      const left = args[0].fn(ctx);
      const right = args[1].fn(ctx);
      if (left.length === 0 || right.length === 0) return [];
      
      // String concatenation requires both operands to be singletons
      if (left.length > 1 || right.length > 1) return [];
      
      return [String(left[0]) + String(right[0])];
    },
    type: compiler.resolveType('String'),
    isSingleton: true,
    source: `${args[0].source || ''} & ${args[1].source || ''}`
  })
};

// Export all arithmetic operators
export const arithmeticOperators = [
  plusOperator,
  minusOperator,
  multiplyOperator,
  divideOperator,
  modOperator,
  divOperator,
  concatOperator,
  unaryPlusOperator,
  unaryMinusOperator
];