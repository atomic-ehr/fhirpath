import { Parser } from './parser';
import { Interpreter, RuntimeContextManager } from './interpreter';
import { Analyzer } from './analyzer';
import type { AnalysisResult } from './types';
import { box, unbox } from './boxing';
import { FHIRPathError, Errors } from './errors';

export interface EvaluateOptions {
  input?: unknown;
  variables?: Record<string, unknown>;
  modelProvider?: import('./types').ModelProvider;
  inputType?: import('./types').TypeInfo;
}

export function evaluate(
  expression: string,
  options: EvaluateOptions = {}
): any[] {
  const parser = new Parser(expression);
  const parseResult = parser.parse();
  
  // Check for parse errors
  if (parseResult.errors.length > 0) {
    // For backward compatibility, throw the first error
    const firstError = parseResult.errors[0]!;
    throw Errors.invalidSyntax(firstError.message);
  }
  
  // ALWAYS analyze the AST
  const analyzer = new Analyzer(options.modelProvider);
  const analysisResult = analyzer.analyze(
    parseResult.ast, 
    options.variables,
    options.inputType
  );
  
  // Check for analysis errors
  const errors = analysisResult.diagnostics.filter(d => d.severity === 1); // DiagnosticSeverity.Error
  if (errors.length > 0) {
    // Throw the first error
    const firstError = errors[0]!;
    if (firstError.code) {
      // Always throw as FHIRPathError if we have a code
      throw new FHIRPathError(firstError.code, firstError.message, firstError.range);
    } else {
      // Otherwise throw a generic error
      throw new Error(firstError.message);
    }
  }
  
  // Use the analyzed AST with type information
  const interpreter = new Interpreter(undefined, options.modelProvider);
  const input = options.input === undefined ? [] : Array.isArray(options.input) ? options.input : [options.input];
  
  // Box input with typeInfo if we have a modelProvider and the input is a FHIR resource
  let boxedInput = input;
  if (options.modelProvider) {
    boxedInput = input.map(item => {
      if (item && typeof item === 'object' && 'resourceType' in item && typeof item.resourceType === 'string') {
        const typeInfo = options.modelProvider!.getType(item.resourceType);
        if (typeInfo) {
          return box(item, typeInfo);
        }
      }
      return item;
    });
  }
  
  // Create context with variables if provided
  let context = RuntimeContextManager.create(input);
  
  // Set $this to the boxed input (required for expressions like $this.where(...))
  context = RuntimeContextManager.setVariable(context, '$this', boxedInput);
  
  // Add model provider to context if available
  if (options.modelProvider) {
    context.modelProvider = options.modelProvider;
  }
  
  if (options.variables) {
    for (const [key, value] of Object.entries(options.variables)) {
      const varValue = Array.isArray(value) ? value : [value];
      context = RuntimeContextManager.setVariable(context, key, varValue);
    }
  }
  
  const result = interpreter.evaluate(analysisResult.ast, input, context);
  
  // Unbox the results before returning
  return result.value.map(unbox);
}

export function analyze(
  expression: string,
  options: { 
    variables?: Record<string, unknown>;
    modelProvider?: import('./types').ModelProvider;
    inputType?: import('./types').TypeInfo;
    errorRecovery?: boolean;
  } = {}
): AnalysisResult {
  // Use LSP mode with error recovery if requested
  const parserOptions = options.errorRecovery 
    ? { mode: 'lsp' as const, errorRecovery: true }
    : undefined;
    
  const parser = new Parser(expression, parserOptions);
  const parseResult = parser.parse();
  
  // Check for parse errors only if error recovery is disabled
  if (!options.errorRecovery && parseResult.errors.length > 0) {
    // For backward compatibility, throw the first error
    const firstError = parseResult.errors[0]!;
    throw Errors.invalidSyntax(firstError.message);
  }
  
  const ast = parseResult.ast;
  
  // Create analyzer with optional model provider
  const analyzer = new Analyzer(options.modelProvider);
  const analysisResult = analyzer.analyze(ast, options.variables, options.inputType);
  
  // If error recovery is enabled, merge parse errors into diagnostics
  if (options.errorRecovery && parseResult.errors.length > 0) {
    // Parse errors are already converted to diagnostics by the analyzer
    // when it encounters Error nodes in the AST
  }
  
  return analysisResult;
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
  FunctionDefinition
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
export { CursorContext, isCursorNode } from './cursor-nodes';
export type {
  CursorNode,
  CursorOperatorNode,
  CursorIdentifierNode,
  CursorArgumentNode,
  CursorIndexNode,
  CursorTypeNode,
  AnyCursorNode
} from './cursor-nodes';
