import { Parser } from './parser';
import { Interpreter } from './interpreter';
import { RuntimeContextManager } from './interpreter/runtime-context';
import { Analyzer } from './analyzer';
import type { AnalysisResult } from './types';
import { box, unbox } from './interpreter/boxing';
import { FHIRPathError, Errors } from './errors';
import { toTemporalString } from './complex-types/temporal';

export interface EvaluateOptions {
  input?: unknown;
  variables?: Record<string, unknown>;
  modelProvider?: import('./types').ModelProvider;
  inputType?: import('./types').TypeInfo;
}

export async function evaluate(
  expression: string,
  options: EvaluateOptions = {}
): Promise<any[]> {
  const parser = new Parser(expression);
  const parseResult = parser.parse();
  
  // Check for parse errors
  if (parseResult.errors.length > 0) {
    // For backward compatibility, throw the first error
    const firstError = parseResult.errors[0]!;
    // Check if it's an unexpected token error
    if (firstError.message.includes('Unexpected token:')) {
      const token = firstError.message.match(/Unexpected token: (.+)/)?.[1] || 'unknown';
      throw Errors.unexpectedToken(token);
    } else if (firstError.message.includes('Unterminated string')) {
      throw Errors.invalidSyntax(firstError.message);
    } else if (firstError.message.includes('Expected')) {
      throw Errors.invalidSyntax(firstError.message);
    } else {
      throw Errors.invalidSyntax(firstError.message);
    }
  }
  
  // ALWAYS analyze the AST
  const analyzer = new Analyzer(options.modelProvider);
  const analysisResult = await analyzer.analyze(
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
    boxedInput = await Promise.all(input.map(async item => {
      if (item && typeof item === 'object' && 'resourceType' in item && typeof item.resourceType === 'string') {
        // Get type info asynchronously
        const typeInfo = await options.modelProvider!.getType(item.resourceType);
        if (typeInfo) {
          return box(item, typeInfo);
        }
      }
      return item;
    }));
  }
  
  // Create context with BOXED input so system vars keep typeInfo
  let context = RuntimeContextManager.create(boxedInput);
  
  // Set $this to the boxed input (required for expressions like $this.where(...))
  context = RuntimeContextManager.setVariable(context, '$this', boxedInput);
  
  // Pre-cache temporal values for deterministic evaluation
  // These will be used by now(), today(), and timeOfDay() functions
  // IMPORTANT: All temporal functions must use the same timestamp
  const now = new Date();
  const { createDateTime, createDate, createTime } = await import('./complex-types/temporal');
  
  // Cache now() value - this is the primary source
  const dateTime = createDateTime(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
    -now.getTimezoneOffset()
  );
  context = RuntimeContextManager.setVariable(context, '__fhirpath_now_cache__', 
    box(dateTime, { type: 'DateTime', singleton: true }));
  
  // Cache today() value - derived from the same dateTime
  const date = createDate(
    dateTime.year,
    dateTime.month,
    dateTime.day
  );
  context = RuntimeContextManager.setVariable(context, '__fhirpath_today_cache__',
    box(date, { type: 'Date', singleton: true }));
  
  // Cache timeOfDay() value - derived from the same dateTime
  const time = createTime(
    dateTime.hour!,  // We know hour exists because we created it above
    dateTime.minute,
    dateTime.second,
    dateTime.millisecond
  );
  context = RuntimeContextManager.setVariable(context, '__fhirpath_timeOfDay_cache__',
    box(time, { type: 'Time', singleton: true }));
  
  // Add model provider to context if available
  if (options.modelProvider) {
    context.modelProvider = options.modelProvider;
  }
  
  if (options.variables) {
    for (const [key, value] of Object.entries(options.variables)) {
      // Normalize to array
      const values = Array.isArray(value) ? value : [value];
      // If modelProvider present, box FHIR resources with typeInfo; keep primitives as-is
      const boxedVars = options.modelProvider
        ? await Promise.all(values.map(async (v) => {
            if (
              v &&
              typeof v === 'object' &&
              'resourceType' in (v as any) &&
              typeof (v as any).resourceType === 'string'
            ) {
              const ti = await options.modelProvider!.getType((v as any).resourceType);
              return ti ? box(v, ti) : v;
            }
            return v;
          }))
        : values;
      context = RuntimeContextManager.setVariable(context, key, boxedVars);
    }
  }
  
  // Evaluate using BOXED input to preserve typeInfo through the pipeline
  const result = await interpreter.evaluate(analysisResult.ast, boxedInput as any[], context);
  
  // Unbox the results before returning
  return result.value.map(boxedValue => {
    const value = unbox(boxedValue);
    // Convert temporal values to string representation for output
    if (value && typeof value === 'object' && 'kind' in value) {
      if (value.kind === 'FHIRDate' || value.kind === 'FHIRDateTime') {
        return '@' + toTemporalString(value);
      } else if (value.kind === 'FHIRTime') {
        // Time values need special handling to add the 'T' prefix
        return '@T' + toTemporalString(value);
      }
    }
    return value;
  });
}

export async function analyze(
  expression: string,
  options: { 
    variables?: Record<string, unknown>;
    modelProvider?: import('./types').ModelProvider;
    inputType?: import('./types').TypeInfo;
    errorRecovery?: boolean;
  } = {}
): Promise<AnalysisResult> {
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
  const analysisResult = await analyzer.analyze(ast, options.variables, options.inputType);
  
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
