import type { ASTNode } from '../parser/ast';
import type { TypeRef } from '../analyzer/types';
import type { RuntimeContext } from '../runtime/context';

// Core expression interface
export interface FHIRPathExpression {
  readonly ast: ASTNode;
  evaluate(input?: any, context?: EvaluationContext): any[];
  compile(options?: CompileOptions): CompiledExpression;
  analyze(options?: AnalyzeOptions): AnalysisResult;
  toString(): string;
}

// Compiled expression function
export interface CompiledExpression {
  (input?: any, context?: EvaluationContext): any[];
  readonly source: string;
}

// Evaluation context for expressions
export interface EvaluationContext {
  variables?: Record<string, any>;
  environment?: Record<string, any>;
  modelProvider?: ModelProvider;
  customFunctions?: CustomFunctionMap;
}

// Custom function definition
export type CustomFunction = (
  context: RuntimeContext,
  input: any[],
  ...args: any[]
) => any[];

export type CustomFunctionMap = Record<string, CustomFunction>;

// Model provider interface
export interface ModelProvider {
  resolveType(typeName: string): TypeRef | undefined;
  getTypeHierarchy(typeName: string): string[];
  getProperties(typeName: string): PropertyDefinition[];
  getTypeName?(type: TypeRef): string;
}

export interface PropertyDefinition {
  name: string;
  type: string;
  isCollection: boolean;
  isRequired: boolean;
}

// Compilation options
export interface CompileOptions {
  optimize?: boolean;
  sourceMap?: boolean;
}

// Analysis options
export interface AnalyzeOptions {
  modelProvider?: ModelProvider;
  strict?: boolean;
}

// Analysis result
export interface AnalysisResult {
  type: TypeRef;
  isSingleton: boolean;
  errors: AnalysisError[];
  warnings: AnalysisWarning[];
}

export interface AnalysisError {
  message: string;
  location?: Location;
  code: string;
}

export interface AnalysisWarning {
  message: string;
  location?: Location;
  code: string;
}

export interface Location {
  line: number;
  column: number;
  offset: number;
  length: number;
}

// Registry API types
export interface RegistryAPI {
  // List operations by type
  listFunctions(): OperationMetadata[];
  listOperators(): OperationMetadata[];
  listAllOperations(): OperationMetadata[];
  
  // Check existence
  hasOperation(name: string): boolean;
  hasFunction(name: string): boolean;
  hasOperator(symbol: string): boolean;
  
  // Get operation metadata (read-only view)
  getOperationInfo(name: string): OperationInfo | undefined;
  
  // Extension validation
  canRegisterFunction(name: string): boolean;
}

// Simplified metadata for public consumption
export interface OperationMetadata {
  name: string;
  kind: 'function' | 'operator' | 'literal';
  syntax: {
    notation: string;  // e.g., "a + b", "substring(start, length)"
  };
}

export interface OperationInfo extends OperationMetadata {
  signature: {
    input?: {
      types?: string[];
      cardinality?: 'singleton' | 'collection' | 'any';
    };
    parameters?: Array<{
      name: string;
      types?: string[];
      cardinality?: 'singleton' | 'collection' | 'any';
      optional?: boolean;
    }>;
    output?: {
      type?: string | 'dynamic';
      cardinality?: 'singleton' | 'collection' | 'preserve-input';
    };
  };
  description?: string;
  examples?: string[];
}

// Builder interfaces
export interface FHIRPathBuilder {
  withModelProvider(provider: ModelProvider): this;
  withCustomFunction(name: string, fn: CustomFunction): this;
  withVariable(name: string, value: any): this;
  build(): FHIRPathAPI;
}

export interface FHIRPathAPI {
  parse(expression: string): FHIRPathExpression;
  evaluate(expression: string | FHIRPathExpression, input?: any): any[];
  compile(expression: string | FHIRPathExpression): CompiledExpression;
  analyze(expression: string | FHIRPathExpression): AnalysisResult;
  inspect(expression: string | FHIRPathExpression, input?: any, context?: EvaluationContext): InspectResult;
  registry: RegistryAPI;
}

// Inspect API types
export interface InspectResult {
  result: any[];
  expression: string;
  ast: ASTNode;
  executionTime: number;
  traces: TraceEntry[];
  evaluationSteps?: EvaluationStep[];
  errors?: ErrorInfo[];
  warnings?: WarningInfo[];
}

export interface TraceEntry {
  name: string;
  values: any[];
  timestamp: number;
  location?: SourceLocation;
  depth: number;
}

export interface EvaluationStep {
  nodeType: string;
  expression: string;
  input: any[];
  output: any[];
  variables: Record<string, any>;
  timestamp: number;
  duration: number;
}

export interface SourceLocation {
  line: number;
  column: number;
  offset: number;
}

export interface ErrorInfo {
  message: string;
  type: string;
  location?: SourceLocation;
  stack?: string;
}

export interface WarningInfo {
  message: string;
  code: string;
  location?: SourceLocation;
}

export interface InspectOptions {
  recordSteps?: boolean;
  maxTraces?: number;
  maxSteps?: number;
}