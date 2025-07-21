import { describe, it, expect } from 'bun:test';
import { FunctionRegistry } from '../../../src/interpreter/functions/registry';
import { evaluateFHIRPath } from '../../../src/interpreter/interpreter';
import type { EnhancedFunctionDefinition } from '../../../src/interpreter/signature-system/types';

describe('EnhancedFunctionRegistry', () => {
  describe('register', () => {
    it('should register enhanced function and make it available via FunctionRegistry', () => {
      const funcDef: EnhancedFunctionDefinition = {
        name: 'testEnhanced',
        arguments: [{
          name: 'value',
          type: 'string'
        }],
        evaluate: (_, context, input, value) => ({ 
          value: [`Enhanced: ${value}`], 
          context 
        })
      };

      FunctionRegistry.register(funcDef);

      // Should be available in main registry
      expect(FunctionRegistry.has('testEnhanced')).toBe(true);

      // Should work with evaluateFHIRPath
      const result = evaluateFHIRPath("testEnhanced('hello')", []);
      expect(result).toEqual(['Enhanced: hello']);
    });

    it('should validate input type when specified', () => {
      const funcDef: EnhancedFunctionDefinition = {
        name: 'stringOnly',
        inputType: 'string',
        evaluate: (_, context, input) => ({ value: input, context })
      };

      FunctionRegistry.register(funcDef);

      // Should work with string input
      const result1 = evaluateFHIRPath("'hello'.stringOnly()", []);
      expect(result1).toEqual(['hello']);

      // Should fail with non-string input
      expect(() => {
        evaluateFHIRPath('123.stringOnly()', []);
      }).toThrow('stringOnly() requires string input');
    });

    it('should support functions with lazy evaluation', () => {
      const funcDef: EnhancedFunctionDefinition = {
        name: 'lazyMap',
        arguments: [{
          name: 'expr',
          type: 'expression',
          evaluationMode: 'lazy'
        }],
        evaluate: (interpreter, context, input, astNode) => {
          // astNode should be the AST node (not evaluated)
          expect(astNode).toBeDefined();
          expect(astNode.type).toBeDefined();
          
          // Map over input, evaluating expression for each item
          const results = [];
          for (let i = 0; i < input.length; i++) {
            const itemContext = {
              ...context,
              env: {
                ...context.env,
                $this: [input[i]],
                $index: i
              }
            };
            const itemResult = interpreter.evaluate(astNode, [input[i]], itemContext);
            results.push(...itemResult.value);
          }
          
          return { value: results, context };
        }
      };

      FunctionRegistry.register(funcDef);

      const result = evaluateFHIRPath('lazyMap($this + 1)', [1, 2, 3]);
      expect(result).toEqual([2, 3, 4]);
    });

    it('should support optional arguments with defaults', () => {
      const funcDef: EnhancedFunctionDefinition = {
        name: 'withDefaults',
        arguments: [
          { name: 'required', type: 'string' },
          { name: 'opt1', type: 'string', optional: true, defaultValue: 'default1' },
          { name: 'opt2', type: 'string', optional: true, defaultValue: 'default2' }
        ],
        evaluate: (_, context, input, required, opt1, opt2) => ({ 
          value: [required, opt1, opt2], 
          context 
        })
      };

      FunctionRegistry.register(funcDef);

      const result1 = evaluateFHIRPath("withDefaults('a')", []);
      expect(result1).toEqual(['a', 'default1', 'default2']);

      const result2 = evaluateFHIRPath("withDefaults('a', 'b')", []);
      expect(result2).toEqual(['a', 'b', 'default2']);

      const result3 = evaluateFHIRPath("withDefaults('a', 'b', 'c')", []);
      expect(result3).toEqual(['a', 'b', 'c']);
    });
  });

  describe('function registry', () => {
    it('should track functions', () => {
      const funcDef: EnhancedFunctionDefinition = {
        name: 'tracked',
        evaluate: () => ({ value: ['tracked'], context: {} as any })
      };

      FunctionRegistry.register(funcDef);

      expect(FunctionRegistry.has('tracked')).toBe(true);
      const registeredFunc = FunctionRegistry.get('tracked');
      expect(registeredFunc).toBeDefined();
      expect(registeredFunc?.name).toBe('tracked');
      expect(FunctionRegistry.has('notRegistered')).toBe(false);
    });
  });
});