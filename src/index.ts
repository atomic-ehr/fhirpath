// Import registry to trigger operation registration
import './registry';

// Core API functions
import { 
  parse, 
  parseLegacy, 
  parseForEvaluation,
  evaluate, 
  compile, 
  analyze, 
  registry,
  isStandardResult,
  isDiagnosticResult,
  validate
} from './api';

// Default export with common operations
export default {
  parse,
  parseLegacy,
  parseForEvaluation,
  evaluate,
  compile,
  analyze,
  registry
};

// Named exports for core functions
export { 
  parse, 
  parseLegacy,
  parseForEvaluation,
  evaluate, 
  compile, 
  analyze, 
  registry,
  isStandardResult,
  isDiagnosticResult,
  validate
};

// Named exports for advanced usage
export { FHIRPath } from './api/builder';
export { FHIRPathError, ErrorCode } from './api/errors';

// Export types
export type {
  // Core types
  FHIRPathExpression,
  CompiledExpression,
  EvaluationContext,
  CompileOptions,
  AnalyzeOptions,
  AnalysisResult,

  // Error types
  AnalysisError,
  AnalysisWarning,
  Location,

  // Extension types
  ModelProvider,
  PropertyDefinition,
  CustomFunction,
  CustomFunctionMap,

  // Registry types
  RegistryAPI,
  OperationMetadata,
  OperationInfo,

  // Builder types
  FHIRPathBuilder,
  FHIRPathAPI
} from './api/types';

// Export parser types
export type {
  ParserOptions,
  ParseResult,
  ParseDiagnostic,
  DiagnosticSeverity,
  TextRange,
  Position as TextPosition
} from './api';

// Export AST types for LSP server
export type {
  ASTNode,
  Position,
  IdentifierNode,
  BinaryNode,
  UnaryNode,
  UnionNode,
  FunctionNode,
  LiteralNode,
  VariableNode,
  CollectionNode,
  MembershipTestNode,
  TypeCastNode,
  TypeReferenceNode,
  IndexNode
} from './parser/ast';

export { NodeType } from './parser/ast';

// Export lexer types for LSP server
export { TokenType } from './lexer/token';
export type { Token } from './lexer/token';
