import type {
  FHIRPathExpression,
  CompiledExpression,
  EvaluationContext,
  CompileOptions,
  AnalyzeOptions,
  AnalysisResult
} from './types';
import { FHIRPathParser } from '../parser/parser';
import { FHIRPathExpression as Expression } from './expression';
import { FHIRPathError, parseError } from './errors';
import { publicRegistry } from './registry';

// Parse expression into AST
export function parse(expression: string): FHIRPathExpression {
  try {
    const parser = new FHIRPathParser(expression);
    const ast = parser.parse();
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
  const expr = typeof expression === 'string' ? parse(expression) : expression;
  return expr.evaluate(input, context);
}

// Compile to optimized function
export function compile(
  expression: string | FHIRPathExpression,
  options?: CompileOptions
): CompiledExpression {
  const expr = typeof expression === 'string' ? parse(expression) : expression;
  return expr.compile(options);
}

// Analyze expression for validation
export function analyze(
  expression: string | FHIRPathExpression,
  options?: AnalyzeOptions
): AnalysisResult {
  const expr = typeof expression === 'string' ? parse(expression) : expression;
  return expr.analyze(options);
}

// Default registry instance
export const registry = publicRegistry;