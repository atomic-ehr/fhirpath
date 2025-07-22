import type { TokenType } from '../lexer/token';
import type { TypeRef, ModelProvider } from '../analyzer/types';
import type { Context, EvaluationResult } from '../interpreter/types';

// Type information returned by analyze
export interface TypeInfo {
  type: TypeRef;
  isSingleton: boolean;
}

// Base interface for all operations
export interface BaseOperation {
  name: string;
  
  // Common lifecycle methods
  analyze: (analyzer: Analyzer, input: TypeInfo, args: TypeInfo[]) => TypeInfo;
  evaluate: (interpreter: Interpreter, context: Context, input: any[], ...args: any[]) => EvaluationResult;
  compile: (compiler: Compiler, input: CompiledExpression, args: CompiledExpression[]) => CompiledExpression;
}

// Operator-specific interface
export interface Operator extends BaseOperation {
  kind: 'operator';
  
  syntax: {
    form: 'prefix' | 'infix' | 'postfix';
    token: TokenType;
    precedence: number;
    associativity?: 'left' | 'right';  // For infix operators
    notation: string;  // e.g., "a + b", "not a"
    special?: boolean;  // For special forms like . and []
    endToken?: TokenType;  // For bracketed operators like []
  };
  
  signature: {
    parameters: [OperatorParameter] | [OperatorParameter, OperatorParameter];  // Unary or binary
    output: {
      type: TypeInferenceRule;
      cardinality: CardinalityInferenceRule;
    };
    propagatesEmpty?: boolean;
  };
}

// Function-specific interface
export interface Function extends BaseOperation {
  kind: 'function';
  
  syntax: {
    notation: string;  // e.g., "substring(start [, length])"
  };
  
  signature: {
    input?: {
      types?: TypeConstraint;
      cardinality?: 'singleton' | 'collection' | 'any';
    };
    parameters: FunctionParameter[];
    output: {
      type: TypeInferenceRule;
      cardinality: CardinalityInferenceRule;
    };
    propagatesEmpty?: boolean;
    deterministic?: boolean;
  };
}

// Literal-specific interface
export interface Literal extends BaseOperation {
  kind: 'literal';
  
  syntax: {
    pattern?: RegExp;      // For complex literals like dates
    keywords?: string[];   // For keyword literals like 'true', 'false'
    notation: string;      // Example: "123", "@2023-01-01"
  };
  
  // Literals have fixed output type
  signature: {
    output: {
      type: string;  // Always a specific type
      cardinality: 'singleton';  // Literals are always singleton
    };
  };
  
  // Parse the literal value from source text
  parse: (value: string) => any;
}

// Union type for registry
export type Operation = Operator | Function | Literal;

// Specialized parameter types
export interface OperatorParameter {
  name: 'left' | 'right' | 'operand';
  types?: TypeConstraint;
  cardinality?: 'singleton' | 'collection' | 'any';  // Required cardinality for this parameter
}

export interface FunctionParameter {
  name: string;
  kind: 'value' | 'expression' | 'type-specifier';
  types?: TypeConstraint;
  cardinality?: 'singleton' | 'collection' | 'any';
  optional?: boolean;
  default?: any;
}

export interface TypeConstraint {
  kind: 'primitive' | 'class' | 'union' | 'any';
  types?: string[];  // ['Integer', 'Decimal'] for numeric, ['Resource'] for FHIR types
}

export type TypeInferenceRule = 
  | string  // Fixed type like 'Boolean'
  | 'preserve-input'  // Returns input type
  | 'promote-numeric'  // Integer + Decimal = Decimal
  | ((input: TypeRef, args: TypeRef[], provider: ModelProvider) => TypeRef);

export type CardinalityInferenceRule = 
  | 'singleton' | 'collection'
  | 'preserve-input'  // Same as input
  | 'all-singleton'  // Singleton only if all inputs are singleton
  | ((input: boolean, args: boolean[]) => boolean);

// Closure-based compiled expression
export interface CompiledExpression {
  // The compiled function
  fn: (context: RuntimeContext) => any[];
  
  // Type information for optimization
  type: TypeRef;
  isSingleton: boolean;
  
  // For debugging/tracing
  source?: string;
}

export interface RuntimeContext {
  input: any[];
  env: Record<string, any>;
  focus?: any;
}

// Interfaces for components that use the registry
export interface Analyzer {
  error(message: string): void;
  warning(message: string): void;
  resolveType(typeName: string): TypeRef;
}

export interface Interpreter {
  evaluate(node: any, input: any[], context: Context): EvaluationResult;
}

export interface Compiler {
  compile(node: any, input: CompiledExpression): CompiledExpression;
  resolveType(typeName: string): TypeRef;
}

// Re-export TypeRef from analyzer
export type { TypeRef } from '../analyzer/types';