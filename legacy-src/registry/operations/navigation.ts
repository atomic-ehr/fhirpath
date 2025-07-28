import { TokenType } from '../../lexer/token';
import type { Operator } from '../types';

export const dotOperator: Operator = {
  name: '.',
  kind: 'operator',
  
  syntax: {
    form: 'infix',
    token: TokenType.DOT,
    precedence: 13, // INVOCATION - highest precedence
    associativity: 'left',
    notation: 'a.b',
    special: true // Special handling in parser
  },
  
  signature: {
    parameters: [
      { name: 'left', types: { kind: 'any' }, cardinality: 'any' },
      { name: 'right', types: { kind: 'any' }, cardinality: 'any' }
    ],
    output: {
      type: 'preserve-input', // Type depends on navigation
      cardinality: 'preserve-input'
    },
    propagatesEmpty: true
  },
  
  analyze: function(analyzer, input, args) {
    // Navigation analysis is complex and handled by the analyzer itself
    // This is a placeholder
    return {
      type: 'Any',
      isSingleton: false
    };
  },
  
  evaluate: function(interpreter, context, input, left, right) {
    // Navigation evaluation is handled by the interpreter
    // This is a placeholder
    return { value: [], context };
  },
  
  compile: function(compiler, input, args) {
    // Navigation compilation is handled by the compiler
    // This is a placeholder
    return input;
  }
};

// Export for registry
export const navigationOperators = [dotOperator];