import { expect } from 'bun:test';
import { Interpreter } from '../../src/interpreter/interpreter';
import { RuntimeContextManager } from '../../src/runtime/context';
import { parse } from '../../src/parser';
import type { Context } from '../../src/interpreter/types';

export function createTestInterpreter() {
  return new Interpreter();
}

export function createTestContext(rootContext?: any[]): Context {
  const input = rootContext || [];
  return RuntimeContextManager.toContext(RuntimeContextManager.create(input));
}

export function evaluateExpression(expression: string, input: any[], context?: Context) {
  const interpreter = createTestInterpreter();
  const ctx = context || createTestContext();
  const ast = parse(expression);
  return interpreter.evaluate(ast, input, ctx);
}

export function expectEvaluation(expression: string, input: any[], expectedValue: any[], context?: Context) {
  const result = evaluateExpression(expression, input, context);
  return expect(result.value).toEqual(expectedValue);
}

export function expectEvaluationError(expression: string, input: any[], errorMessage: string | RegExp, context?: Context) {
  return expect(() => evaluateExpression(expression, input, context)).toThrow(errorMessage);
}

export function createContextWithVariable(varName: string, value: any[]): Context {
  const rtContext = RuntimeContextManager.create([]);
  const newRtContext = RuntimeContextManager.setVariable(rtContext, varName, value);
  return RuntimeContextManager.toContext(newRtContext);
}

export function createContextWithIterator(value: any, index: number): Context {
  const rtContext = RuntimeContextManager.create([]);
  const newRtContext = RuntimeContextManager.withIterator(rtContext, value, index);
  return RuntimeContextManager.toContext(newRtContext);
}