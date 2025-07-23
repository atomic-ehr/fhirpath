import { expect } from 'bun:test';
import { Interpreter } from '../../src/interpreter/interpreter';
import { ContextManager } from '../../src/interpreter/context';
import { parse } from '../../src/parser';
import type { Context } from '../../src/interpreter/types';

export function createTestInterpreter() {
  return new Interpreter();
}

export function createTestContext(rootContext?: any[]): Context {
  return ContextManager.create(rootContext);
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
  const context = createTestContext();
  return ContextManager.setVariable(context, varName, value);
}

export function createContextWithIterator(value: any, index: number): Context {
  const context = createTestContext();
  return ContextManager.setIteratorContext(context, value, index);
}