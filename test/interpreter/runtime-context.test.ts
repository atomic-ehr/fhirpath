import { describe, it, expect } from 'bun:test';
import { RuntimeContextManager } from '../../src/interpreter/runtime-context';
import { Errors } from '../../src/errors';

describe('RuntimeContextManager', () => {
  it('create initializes % variables and null-prototype variables object', () => {
    const ctx = RuntimeContextManager.create([1, 2, 3]);
    expect(ctx.variables['%context']).toEqual([1, 2, 3]);
    expect(ctx.variables['%resource']).toEqual([1, 2, 3]);
    expect(ctx.variables['%rootResource']).toEqual([1, 2, 3]);
    // null-prototype check
    expect(Object.getPrototypeOf(ctx.variables)).toBe(null);
  });

  it('setVariable prevents overriding system variables', () => {
    const ctx = RuntimeContextManager.create([]);
    expect(() => RuntimeContextManager.setVariable(ctx, 'resource', 1)).toThrow();
    expect(() => RuntimeContextManager.setVariable(ctx, '%context', 1)).toThrow();
  });

  it('withIterator sets $this, $index and updates input/focus', () => {
    const base = RuntimeContextManager.create([]);
    const item = { a: 1 };
    const iter = RuntimeContextManager.withIterator(base, item, 5);
    const thisVal = RuntimeContextManager.getVariable(iter, '$this');
    const indexVal = RuntimeContextManager.getVariable(iter, '$index');
    expect(thisVal).toEqual([item]);
    expect(indexVal).toBe(5);
    expect(iter.input).toEqual([item]);
    expect(iter.focus).toEqual([item]);
  });

  it('getVariable resolves inherited user variables with % prefix handling', () => {
    const base = RuntimeContextManager.create([]);
    const withFoo = RuntimeContextManager.setVariable(base, 'foo', 123);
    const child = RuntimeContextManager.copy(withFoo);
    // Access with and without % prefix
    expect(RuntimeContextManager.getVariable(child, 'foo')).toEqual([123]);
    expect(RuntimeContextManager.getVariable(child, '%foo')).toEqual([123]);
  });

  it('setVariable enforces redefinition rules except iteration vars', () => {
    const base = RuntimeContextManager.create([]);
    const withX = RuntimeContextManager.setVariable(base, 'x', 10);
    expect(() => RuntimeContextManager.setVariable(withX, 'x', 20)).toThrow();

    // Iteration variables can be redefined
    const withThis = RuntimeContextManager.setVariable(base, '$this', [1], true);
    const withThisAgain = RuntimeContextManager.setVariable(withThis, '$this', [2]);
    expect(RuntimeContextManager.getVariable(withThisAgain, '$this')).toEqual([2]);

    const withIndex = RuntimeContextManager.setVariable(base, '$index', 1, true);
    const withIndexAgain = RuntimeContextManager.setVariable(withIndex, '$index', 2);
    expect(RuntimeContextManager.getVariable(withIndexAgain, '$index')).toBe(2);
  });

  it('withInput updates input and focus while preserving prototype chain', () => {
    const base = RuntimeContextManager.create([0]);
    const child = RuntimeContextManager.setVariable(base, 'foo', 1);
    const moved = RuntimeContextManager.withInput(child, [42]);
    expect(moved.input).toEqual([42]);
    expect(moved.focus).toEqual([42]);
    // Inherited variable still available
    expect(RuntimeContextManager.getVariable(moved, 'foo')).toEqual([1]);
  });
});

