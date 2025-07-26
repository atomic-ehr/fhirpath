import { expect } from 'bun:test';
import { Interpreter } from '../../src/interpreter/interpreter';
import { RuntimeContextManager } from '../../src/runtime/context';
import type { RuntimeContext } from '../../src/runtime/context';
import { parseForEvaluation } from '../../src/api';

export function createTestInterpreter() {
  return new Interpreter();
}

export function createTestContext(rootContext?: any[]): RuntimeContext {
  const input = rootContext || [];
  return RuntimeContextManager.create(input);
}

export function evaluateExpression(expression: string, input: any[], context?: RuntimeContext) {
  const interpreter = createTestInterpreter();
  const ctx = context || createTestContext();
  const ast = parseForEvaluation(expression);
  return interpreter.evaluate(ast, input, ctx);
}

export function expectEvaluation(expression: string, input: any[], expectedValue: any[], context?: RuntimeContext) {
  const result = evaluateExpression(expression, input, context);
  return expect(result.value).toEqual(expectedValue);
}

export function expectEvaluationError(expression: string, input: any[], errorMessage: string | RegExp, context?: RuntimeContext) {
  return expect(() => evaluateExpression(expression, input, context)).toThrow(errorMessage);
}

export function createContextWithVariable(varName: string, value: any[]): RuntimeContext {
  const rtContext = RuntimeContextManager.create([]);
  return RuntimeContextManager.setVariable(rtContext, varName, value);
}

export function createContextWithIterator(value: any, index: number): RuntimeContext {
  const rtContext = RuntimeContextManager.create([]);
  return RuntimeContextManager.withIterator(rtContext, value, index);
}