// Import registry to trigger operation registration
import './registry';

// Core API functions
import { parse, evaluate, compile, analyze, registry } from './api/index';

// Default export with common operations
export default {
  parse,
  evaluate,
  compile,
  analyze,
  registry
};

// Named exports for core functions
export { parse, evaluate, compile, analyze, registry };

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