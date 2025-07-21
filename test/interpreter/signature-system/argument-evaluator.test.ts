import { describe, it, expect } from 'bun:test';
import { ArgumentEvaluator } from '../../../src/interpreter/signature-system/argument-evaluator';
import { Interpreter } from '../../../src/interpreter/interpreter';
import { ContextManager } from '../../../src/interpreter/context';
import { FHIRPathParser } from '../../../src/parser/parser';
import { FHIRPathLexer } from '../../../src/lexer/lexer';
import type { EnhancedFunctionDefinition } from '../../../src/interpreter/signature-system/types';
import type { FunctionNode } from '../../../src/parser/ast';

describe('ArgumentEvaluator', () => {
  const interpreter = new Interpreter();
  const context = ContextManager.create([]);

  function parseFunction(expr: string): FunctionNode {
    const lexer = new FHIRPathLexer(expr);
    const tokens = lexer.tokenize();
    const parser = new FHIRPathParser(tokens);
    const ast = parser.parse();
    return ast as FunctionNode; // Cast since we know it's a function
  }

  describe('evaluateArguments', () => {
    it('should evaluate eager arguments by default', () => {
      const funcDef: EnhancedFunctionDefinition = {
        name: 'test',
        arguments: [{
          name: 'value',
          type: 'string'
        }],
        evaluate: () => ({ value: [], context })
      };

      const node = parseFunction("test('hello')");
      const result = ArgumentEvaluator.evaluateArguments(
        funcDef,
        node,
        [],
        context,
        interpreter
      );

      expect(result).toEqual(['hello']);
    });

    it('should handle lazy evaluation mode', () => {
      const funcDef: EnhancedFunctionDefinition = {
        name: 'test',
        arguments: [{
          name: 'expr',
          type: 'expression',
          evaluationMode: 'lazy'
        }],
        evaluate: () => ({ value: [], context })
      };

      const node = parseFunction("test(1 + 2)");
      const result = ArgumentEvaluator.evaluateArguments(
        funcDef,
        node,
        [],
        context,
        interpreter
      );

      // For lazy evaluation, the AST node should be returned
      expect(result[0]).toBeDefined();
      expect(result[0].type).toBeDefined(); // It's an AST node
    });

    it('should handle optional arguments', () => {
      const funcDef: EnhancedFunctionDefinition = {
        name: 'test',
        arguments: [
          { name: 'required', type: 'string' },
          { name: 'optional', type: 'string', optional: true, defaultValue: 'default' }
        ],
        evaluate: () => ({ value: [], context })
      };

      const node = parseFunction("test('value')");
      const result = ArgumentEvaluator.evaluateArguments(
        funcDef,
        node,
        [],
        context,
        interpreter
      );

      expect(result).toEqual(['value', 'default']);
    });

    it('should use different evaluation contexts', () => {
      const funcDef: EnhancedFunctionDefinition = {
        name: 'test',
        arguments: [{
          name: 'value',
          type: 'collection',
          evaluationContext: 'input'
        }],
        evaluate: () => ({ value: [], context })
      };

      const node = parseFunction("test(name)");
      const result = ArgumentEvaluator.evaluateArguments(
        funcDef,
        node,
        [{ name: 'John' }],
        context,
        interpreter
      );

      expect(result).toEqual([['John']]);
    });

    it('should validate arity', () => {
      const funcDef: EnhancedFunctionDefinition = {
        name: 'test',
        arguments: [
          { name: 'arg1', type: 'string' },
          { name: 'arg2', type: 'string' }
        ],
        evaluate: () => ({ value: [], context })
      };

      const node = parseFunction("test('only one')");
      
      expect(() => {
        ArgumentEvaluator.evaluateArguments(funcDef, node, [], context, interpreter);
      }).toThrow('Function test expects at least 2 arguments, got 1');
    });

    it('should handle variable arity', () => {
      const funcDef: EnhancedFunctionDefinition = {
        name: 'test',
        arguments: [
          { name: 'required', type: 'string' },
          { name: 'optional1', type: 'string', optional: true },
          { name: 'optional2', type: 'string', optional: true }
        ],
        evaluate: () => ({ value: [], context })
      };

      const node1 = parseFunction("test('a')");
      const result1 = ArgumentEvaluator.evaluateArguments(funcDef, node1, [], context, interpreter);
      expect(result1).toEqual(['a', undefined, undefined]);

      const node2 = parseFunction("test('a', 'b')");
      const result2 = ArgumentEvaluator.evaluateArguments(funcDef, node2, [], context, interpreter);
      expect(result2).toEqual(['a', 'b', undefined]);

      const node3 = parseFunction("test('a', 'b', 'c')");
      const result3 = ArgumentEvaluator.evaluateArguments(funcDef, node3, [], context, interpreter);
      expect(result3).toEqual(['a', 'b', 'c']);
    });

    it('should apply custom validators', () => {
      const funcDef: EnhancedFunctionDefinition = {
        name: 'test',
        arguments: [{
          name: 'value',
          type: 'integer',
          validator: (v) => v > 0
        }],
        evaluate: () => ({ value: [], context })
      };

      const nodeValid = parseFunction("test(5)");
      const resultValid = ArgumentEvaluator.evaluateArguments(funcDef, nodeValid, [], context, interpreter);
      expect(resultValid).toEqual([5]);

      const nodeInvalid = parseFunction("test(-5)");
      expect(() => {
        ArgumentEvaluator.evaluateArguments(funcDef, nodeInvalid, [], context, interpreter);
      }).toThrow('test() value failed validation');
    });
  });
});