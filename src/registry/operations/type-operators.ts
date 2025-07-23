import { TokenType } from '../../lexer/token';
import type { Operator } from '../types';
import type { Analyzer, TypeInfo } from '../types';
import { EvaluationError } from '../../interpreter/types';
import type { Context, EvaluationResult } from '../../interpreter/types';
import type { CompiledExpression } from '../../compiler/types';

// Type operators (is, as) need special handling in the parser
// They are included here for precedence lookup and keyword registration

export const isOperator: Operator = {
  name: 'is',
  kind: 'operator',
  syntax: {
    form: 'infix',
    token: TokenType.IS,
    precedence: 6,
    associativity: 'left',
    notation: 'a is Type',
    special: true  // Requires special parsing
  },
  signature: {
    parameters: [{ name: 'left' }, { name: 'right' }],
    output: {
      type: 'Boolean',
      cardinality: 'singleton'
    },
    propagatesEmpty: false
  },
  analyze: (analyzer: Analyzer, input: TypeInfo, args: TypeInfo[]): TypeInfo => {
    // Always returns boolean
    return {
      type: analyzer.resolveType('Boolean'),
      isSingleton: input.isSingleton
    };
  },
  evaluate: (interpreter, context, input, value, typeName) => {
    // Type checking is handled by the interpreter
    throw new Error('is operator requires special handling');
  },
  compile: (compiler, input, args) => {
    throw new EvaluationError('is operator requires special compilation');
  }
};

export const asOperator: Operator = {
  name: 'as',
  kind: 'operator',
  syntax: {
    form: 'infix',
    token: TokenType.AS,
    precedence: 6,
    associativity: 'left',
    notation: 'a as Type',
    special: true  // Requires special parsing
  },
  signature: {
    parameters: [{ name: 'left' }, { name: 'right' }],
    output: {
      type: 'preserve-input',
      cardinality: 'preserve-input'
    },
    propagatesEmpty: true
  },
  analyze: (analyzer: Analyzer, input: TypeInfo, args: TypeInfo[]): TypeInfo => {
    // Returns the target type (determined by parser)
    // This is a placeholder - actual type is set by parser
    return {
      type: analyzer.resolveType('Any'),
      isSingleton: input.isSingleton
    };
  },
  evaluate: (interpreter, context, input, value, typeName) => {
    // Type casting is handled by the interpreter
    throw new Error('as operator requires special handling');
  },
  compile: (compiler, input, args) => {
    throw new EvaluationError('as operator requires special compilation');
  }
};

// Export type operators
export const typeOperators = [
  isOperator,
  asOperator
];