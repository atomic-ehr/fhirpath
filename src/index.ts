import { Parser } from './parser';
import { Interpreter, RuntimeContextManager } from './interpreter';
import { Analyzer } from './analyzer';
import type { AnalysisResult } from './types';

export interface EvaluateOptions {
  input?: unknown;
  variables?: Record<string, unknown>;
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
    throw new Error(firstError.message);
  }
  
  const ast = parseResult.ast;
  
  const interpreter = new Interpreter();
  const input = options.input === undefined ? [] : Array.isArray(options.input) ? options.input : [options.input];
  
  // Create context with variables if provided
  let context = RuntimeContextManager.create(input);
  
  // Set $this to the input (required for expressions like $this.where(...))
  context = RuntimeContextManager.setVariable(context, '$this', input);
  
  if (options.variables) {
    for (const [key, value] of Object.entries(options.variables)) {
      const varValue = Array.isArray(value) ? value : [value];
      context = RuntimeContextManager.setVariable(context, key, varValue);
    }
  }
  
  const result = interpreter.evaluate(ast, input, context);
  
  return result.value;
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
    throw new Error(firstError.message);
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
export type { 
  ParseResult, 
  Diagnostic, 
  AnalysisResult, 
  ASTNode,
  TypeInfo,
  TypeName,
  ModelProvider as ModelTypeProvider 
} from './types';

// Export FHIR ModelProvider
export { FHIRModelProvider } from './model-provider';
export type { FHIRModelContext, FHIRModelProviderConfig } from './model-provider';

// Export inspect API
export { inspect } from './inspect';
export type { InspectOptions, InspectResult, TraceEntry } from './inspect';
