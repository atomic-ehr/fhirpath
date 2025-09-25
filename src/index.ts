import { Parser } from './parser';
import { Interpreter } from './interpreter';
import { Analyzer } from './analyzer';
import type { AnalysisResult, EvaluationResult, ModelProvider, TypeInfo } from './types';

declare const __VERSION__: string;

export interface EvaluateOptions {
  input?: unknown;
  variables?: Record<string, unknown>;
  modelProvider?: ModelProvider;
  inputType?: TypeInfo;
  includeMetadata?: boolean;
}

export async function evaluate(
  expression: string,
  options: EvaluateOptions = {}
): Promise<EvaluationResult['value']> {
  const interpreter = new Interpreter(undefined, options.modelProvider);
  return interpreter.evaluateExpression(expression, {
    input: options.input,
    variables: options.variables,
    inputType: options.inputType,
    modelProvider: options.modelProvider,
    includeMetadata: options.includeMetadata
  });
}


export async function analyze(
  expression: string,
  options: { 
    variables?: Record<string, unknown>;
    modelProvider?: ModelProvider;
    inputType?: TypeInfo;
    errorRecovery?: boolean;
  } = {}
): Promise<AnalysisResult> {
  const analysisResult = await Analyzer.analyzeExpression(expression, {
    variables: options.variables,
    modelProvider: options.modelProvider,
    inputType: options.inputType,
    errorRecovery: options.errorRecovery,
  });
  return analysisResult;
}

export function getVersion(): string {
  return __VERSION__;
}

// Export key types and classes
export { Parser } from './parser';
export { Interpreter } from './interpreter';
export { Analyzer } from './analyzer';
export { parse } from './parser';
export { DiagnosticSeverity } from './types';
export { Registry, registry } from './registry';
export type { 
  ParseResult, 
  Diagnostic, 
  AnalysisResult, 
  ASTNode,
  TypeInfo,
  TypeName,
  ModelProvider as ModelTypeProvider,
  OperatorDefinition,
  FunctionDefinition,
  EvaluationResult
} from './types';

// Export FHIR ModelProvider
export { FHIRModelProvider } from './model-provider';
export type { FHIRModelContext, FHIRModelProviderConfig } from './model-provider';

// Export inspect API
export { inspect } from './inspect';
export type { InspectOptions, InspectResult, ASTMetadata } from './inspect';

// Export error system
export { FHIRPathError, Errors, ErrorCodes } from './errors';

// Export LSP support - completion provider and cursor nodes
/**
 * Provides context-aware code completions for FHIRPath expressions.
 * @param expression - The FHIRPath expression being edited
 * @param cursorPosition - The cursor position (0-based offset)
 * @param options - Optional configuration including modelProvider and variables
 * @returns Array of completion items with labels, kinds, and documentation
 * 
 * @example
 * ```typescript
 * import { provideCompletions } from 'fhirpath';
 * 
 * const completions = provideCompletions('Patient.', 8);
 * // Returns completions for properties and functions after 'Patient.'
 * ```
 */
export { provideCompletions, CompletionKind } from './completion-provider';
export type { 
  CompletionItem, 
  CompletionOptions
} from './completion-provider';

// Export cursor node types for LSP integration
export { CursorContext, isCursorNode } from './parser/cursor-nodes';
export type {
  CursorNode,
  CursorOperatorNode,
  CursorIdentifierNode,
  CursorArgumentNode,
  CursorIndexNode,
  CursorTypeNode,
  AnyCursorNode
} from './parser/cursor-nodes';
