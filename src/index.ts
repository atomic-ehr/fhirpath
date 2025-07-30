import { Parser } from './parser';
import { LSPParser } from './parser-lsp';
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
  const ast = parser.parse();
  
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
  options: { variables?: Record<string, unknown> } = {}
): AnalysisResult {
  // TODO: Use LSPParser once it's migrated to unified AST
  const parser = new Parser(expression);
  const ast = parser.parse();
  
  const analyzer = new Analyzer();
  return analyzer.analyze(ast, options.variables);
}
