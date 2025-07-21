import { describe, it, expect, beforeEach } from 'bun:test';
import { FunctionBuilder } from '../../../src/interpreter/helpers/function-builder';
import { FunctionRegistry } from '../../../src/interpreter/functions';
import { Interpreter } from '../../../src/interpreter/interpreter';
import { ContextManager } from '../../../src/interpreter/context';

describe('FunctionBuilder', () => {
  const interpreter = new Interpreter();
  const context = ContextManager.create();

  beforeEach(() => {
    // Clear registry before each test
    (FunctionRegistry as any).functions.clear();
  });

  it('should build function with string input validation', () => {
    const fn = FunctionBuilder.build({
      name: 'testString',
      arity: 0,
      inputType: 'string',
      implementation: (args, input: string, ctx) => ({
        value: [input.toUpperCase()],
        context: ctx
      })
    });

    // Valid string input
    const result = fn.evaluate(interpreter, [], ['hello'], context);
    expect(result.value).toEqual(['HELLO']);

    // Invalid input
    expect(() => fn.evaluate(interpreter, [], [42], context))
      .toThrow('testString() requires a string input');

    // Empty input
    expect(() => fn.evaluate(interpreter, [], [], context))
      .toThrow('testString() requires a string input');
  });

  it('should build function with argument validation', () => {
    const fn = FunctionBuilder.build({
      name: 'substring',
      arity: 2,
      inputType: 'string',
      argTypes: [
        { name: 'start', type: 'integer' },
        { name: 'length', type: 'integer', optional: true }
      ],
      implementation: (args, input: string, ctx) => {
        const [start, length] = args;
        const result = length !== undefined 
          ? input.substring(start, start + length)
          : input.substring(start);
        return { value: [result], context: ctx };
      }
    });

    // Valid arguments
    const result1 = fn.evaluate(interpreter, [[5], [3]], ['hello world'], context);
    expect(result1.value).toEqual([' wo']);

    // Optional argument omitted
    const result2 = fn.evaluate(interpreter, [[6], []], ['hello world'], context);
    expect(result2.value).toEqual(['world']);

    // Invalid start type
    expect(() => fn.evaluate(interpreter, [['5'], [3]], ['hello world'], context))
      .toThrow('substring() start must be an integer');

    // Invalid length type
    expect(() => fn.evaluate(interpreter, [[5], ['3']], ['hello world'], context))
      .toThrow('substring() length must be an integer');
  });

  it('should build function with collection input', () => {
    const fn = FunctionBuilder.build({
      name: 'count',
      arity: 0,
      inputType: 'collection',
      implementation: (args, input: any[], ctx) => ({
        value: [input.length],
        context: ctx
      })
    });

    // Valid collection
    const result = fn.evaluate(interpreter, [], [1, 2, 3], context);
    expect(result.value).toEqual([3]);

    // Empty collection should throw
    expect(() => fn.evaluate(interpreter, [], [], context))
      .toThrow('count() requires non-empty input');
  });

  it('should build function with mixed argument types', () => {
    const fn = FunctionBuilder.build({
      name: 'replace',
      arity: 2,
      inputType: 'string',
      argTypes: [
        { name: 'pattern', type: 'string' },
        { name: 'replacement', type: 'string' }
      ],
      implementation: (args, input: string, ctx) => {
        const [pattern, replacement] = args;
        return { 
          value: [input.replace(pattern, replacement)], 
          context: ctx 
        };
      }
    });

    // Valid usage
    const result = fn.evaluate(interpreter, [['world'], ['universe']], ['hello world'], context);
    expect(result.value).toEqual(['hello universe']);

    // Missing argument
    expect(() => fn.evaluate(interpreter, [['world'], []], ['hello world'], context))
      .toThrow('replace() requires replacement argument');
  });

  it('should handle non-evaluated arguments', () => {
    const fn = FunctionBuilder.build({
      name: 'lambda',
      arity: 1,
      evaluateArgs: false,
      argTypes: [{ name: 'expression', type: 'any' }],
      implementation: (args, input, ctx) => {
        // Args should be AST nodes when evaluateArgs is false
        return { value: ['lambda processed'], context: ctx };
      }
    });

    // Should not validate pre-evaluated args
    const result = fn.evaluate(interpreter, [{ type: 'ast' } as any], ['input'], context);
    expect(result.value).toEqual(['lambda processed']);
  });

  it('should handle any type arguments', () => {
    const fn = FunctionBuilder.build({
      name: 'identity',
      arity: 1,
      argTypes: [{ name: 'value', type: 'any' }],
      implementation: (args, input, ctx) => {
        const [value] = args;
        return { value: [value], context: ctx };
      }
    });

    // Should accept any type
    expect(fn.evaluate(interpreter, [['string']], [], context).value).toEqual(['string']);
    expect(fn.evaluate(interpreter, [[42]], [], context).value).toEqual([42]);
    expect(fn.evaluate(interpreter, [[true]], [], context).value).toEqual([true]);
  });
});