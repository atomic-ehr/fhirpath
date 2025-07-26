import type {
  FHIRPathExpression,
  CompiledExpression,
  EvaluationContext,
  CompileOptions,
  AnalyzeOptions,
  AnalysisResult,
  InspectResult,
  InspectOptions
} from './types';
import { FHIRPathParser } from '../parser/parser';
import { 
  type ParserOptions,
  type ParseResult,
  type ParseDiagnostic,
  type TextRange
} from '../parser/types';
import type { ASTNode } from '../parser/ast';
import { FHIRPathExpression as Expression } from './expression';
import { FHIRPathError, parseError } from './errors';
import { publicRegistry } from './registry';
import { inspect as inspectImpl } from './inspect';

// Export parser types for API consumers
export { 
  type ParserOptions,
  type ParseResult,
  type ParseDiagnostic,
  type DiagnosticSeverity,
  type TextRange,
  type Position
} from '../parser/types';

// New parse function with mode support
export function parse(expression: string, options: ParserOptions = {}): ParseResult {
  const parser = new FHIRPathParser(expression, options);
  return parser.parse();
}

// Convenience function for evaluation (throws on error)
export function parseForEvaluation(expression: string): ASTNode {
  const result = parse(expression, { throwOnError: true });
  return result.ast;
}

// Type guards for result types

export function isStandardResult(result: ParseResult): result is ParseResult {
  return 'ast' in result && 'diagnostics' in result && 'hasErrors' in result;
}

export function isDiagnosticResult(result: ParseResult): result is ParseResult & { isPartial: boolean; ranges: Map<ASTNode, TextRange> } {
  return isStandardResult(result) && 'isPartial' in result && 'ranges' in result;
}

// Validate function - alternative to removed Validate mode
export function validate(expression: string): { valid: boolean; diagnostics: ParseDiagnostic[] } {
  const result = parse(expression);
  if (isStandardResult(result)) {
    return {
      valid: !result.hasErrors,
      diagnostics: result.diagnostics
    };
  }
  // Should not happen, but handle gracefully
  return { valid: true, diagnostics: [] };
}

// Legacy parse function for backward compatibility
export function parseLegacy(expression: string): FHIRPathExpression {
  try {
    const ast = parseForEvaluation(expression);
    return new Expression(ast, expression);
  } catch (error) {
    if (error instanceof Error) {
      throw parseError(error.message, undefined, expression);
    }
    throw parseError(String(error), undefined, expression);
  }
}

// Evaluate expression directly
export function evaluate(
  expression: string | FHIRPathExpression,
  input?: any,
  context?: EvaluationContext
): any[] {
  const expr = typeof expression === 'string' ? parseLegacy(expression) : expression;
  return expr.evaluate(input, context);
}

// Compile to optimized function
export function compile(
  expression: string | FHIRPathExpression,
  options?: CompileOptions
): CompiledExpression {
  const expr = typeof expression === 'string' ? parseLegacy(expression) : expression;
  return expr.compile(options);
}

// Analyze expression for validation
export function analyze(
  expression: string | FHIRPathExpression,
  options?: AnalyzeOptions
): AnalysisResult {
  const expr = typeof expression === 'string' ? parseLegacy(expression) : expression;
  return expr.analyze(options);
}

// Inspect expression with debugging information
export function inspect(
  expression: string | FHIRPathExpression,
  input?: any,
  context?: EvaluationContext,
  options?: InspectOptions
): InspectResult {
  return inspectImpl(expression, input, context, options);
}

// Default registry instance
export const registry = publicRegistry;