import { Parser } from './parser';
import { Interpreter } from './interpreter';
import type { FHIRPathValue } from './types';

export interface EvaluateOptions {
  input?: unknown;
  variables?: Record<string, unknown>;
}

export function evaluate(
  expression: string,
  options: EvaluateOptions = {}
): FHIRPathValue[] {
  const parser = new Parser(expression);
  const ast = parser.parse();
  
  const interpreter = new Interpreter();
  const input = options.input === undefined ? [] : Array.isArray(options.input) ? options.input : [options.input];
  const result = interpreter.evaluate(ast, input, options.variables);
  
  return result.value;
}