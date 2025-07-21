import { Interpreter } from '../src/interpreter/interpreter';
import { ContextManager } from '../src/interpreter/context';
import { parse, pprint } from '../src/parser';
import { it, describe, beforeEach, expect } from 'bun:test';
import type { Context } from '../src/interpreter/types';

describe('FHIRPath Interpreter', () => {
  let interpreter: Interpreter;
  let context: Context;

  beforeEach(() => {
    interpreter = new Interpreter();
    context = ContextManager.create();
  });

  let fp = (expr: string, input: any) => {
      const ast = parse(expr);
      // Set up context with initial $this
      const ctxWithThis = {
        ...context,
        env: {
          ...context.env,
          $this: input
        }
      };
      const result = interpreter.evaluate(ast, input, ctxWithThis);
      return result.value;
  }

  describe('handling this', () => {
    it('tracking this', () => {
        expect(fp("$this", [1])).toEqual([1]);
        expect(fp("name.select($this)", [{name: [1]}, {name: [2]}])).toEqual([1, 2]);
        expect(fp("name.given.select($this)", [{name: [{given: [1]}]}, {name: [{given: [2]}]}])).toEqual([1, 2]);
        expect(fp("length()", ["123"])).toEqual([3]);
        expect(fp("substring(0, length() -2 )", ["1234"])).toEqual(['12']);
    });
  });

  describe('tricky case with function params', () => {
      it('tricky case', () => {
        expect(() => fp("'string'.substring(0, length() -2 )", [{}])).toThrow();
        expect(fp("'string'.substring(0, length() -2 )", ['aa'])).toEqual(['']);
        expect(fp("name.select( 'b1b2b3b4'.select(substring(0, length() -2 )) )", [{name: ['aaa']}])).toEqual(['b1b2b3']);
        expect(fp("name.select( 'bbbbbb'.substring(0, length() -2 ))", [{name: ['aaa']}])).toEqual(['b']);
      });
  });
});