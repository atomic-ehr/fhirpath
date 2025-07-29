import { Parser } from './parser';
import { Interpreter, RuntimeContextManager } from './interpreter';

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
  if (options.variables) {
    for (const [key, value] of Object.entries(options.variables)) {
      const varValue = Array.isArray(value) ? value : [value];
      context = RuntimeContextManager.setVariable(context, key, varValue);
    }
  }
  
  const result = interpreter.evaluate(ast, input, context);
  
  return result.value;
}