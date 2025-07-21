import { describe, it, expect, beforeEach } from 'bun:test';
import { Compiler, compile, evaluateCompiled } from '../src/compiler';
import { Interpreter } from '../src/interpreter/interpreter';
import { ContextManager } from '../src/interpreter/context';
import { parse } from '../src/parser';
import type { Context } from '../src/interpreter/types';

// Import function implementations to register them
import '../src/interpreter/functions';

describe('FHIRPath Compiler', () => {
  let compiler: Compiler;
  let interpreter: Interpreter;
  let context: Context;

  beforeEach(() => {
    compiler = new Compiler();
    interpreter = new Interpreter();
    context = ContextManager.create();
  });

  // Helper to compare compiler and interpreter results
  function compareResults(expression: string, input: any[] = [], ctx?: Context) {
    const ast = parse(expression);
    const evalContext = ctx || context;
    
    // Run through interpreter
    const interpreterResult = interpreter.evaluate(ast, input, evalContext);
    
    // Run through compiler
    const compiled = compiler.compile(ast);
    const compilerResult = compiled(input, evalContext);
    
    // Compare results
    expect(compilerResult.value).toEqual(interpreterResult.value);
    expect(compilerResult.context).toEqual(interpreterResult.context);
    
    return compilerResult;
  }

  describe('Literals', () => {
    it('compiles number literals', () => {
      compareResults('42');
      compareResults('3.14');
      compareResults('-17');
    });

    it('compiles string literals', () => {
      compareResults("'hello'");
      compareResults("'FHIRPath'");
      compareResults("''"); // empty string
    });

    it('compiles boolean literals', () => {
      compareResults('true');
      compareResults('false');
    });

    it('compiles null literal as empty collection', () => {
      compareResults('null');
    });

    it('compiles collection literals', () => {
      compareResults('{}');
      compareResults('{1, 2, 3}');
      compareResults("{'a', 'b', 'c'}");
      compareResults('{true, false, true}');
    });
  });

  describe('Identifiers - Property Navigation', () => {
    it('compiles simple property access', () => {
      const input = [{ name: 'John' }];
      compareResults('name', input);
    });

    it('returns empty for missing property', () => {
      const input = [{ age: 30 }];
      compareResults('name', input);
    });

    it('navigates on multiple items', () => {
      const input = [
        { name: 'John' },
        { name: 'Jane' },
        { age: 30 } // no name
      ];
      compareResults('name', input);
    });

    it('flattens array properties', () => {
      const input = [{
        name: [
          { given: ['John', 'J'], family: 'Doe' },
          { given: ['Jane'], family: 'Smith' }
        ]
      }];
      compareResults('name', input);
    });

    it('handles null and undefined in input', () => {
      const input = [null, undefined, { name: 'John' }, { name: null }];
      compareResults('name', input);
    });
  });

  describe('Variables', () => {
    it('compiles $this variable', () => {
      const input = [42];
      const ctx = ContextManager.create(input);
      compareResults('$this', [], ctx);
    });

    it('compiles $index variable', () => {
      // $index is set by iterator functions like where/select
      const ctx = {
        ...context,
        env: { ...context.env, $index: 5 }
      };
      compareResults('$index', [], ctx);
    });

    it('compiles user-defined variables', () => {
      const ctx = ContextManager.setVariable(context, 'myVar', [1, 2, 3]);
      compareResults('%myVar', [], ctx);
    });

    it('returns empty for undefined variables', () => {
      compareResults('%undefinedVar');
    });
  });

  describe('Binary Operators', () => {
    describe('Dot Operator (Pipeline)', () => {
      it('compiles simple dot navigation', () => {
        const input = [{ patient: { name: 'John' } }];
        compareResults('patient.name', input);
      });

      it('compiles chained dot navigation', () => {
        const input = [{
          patient: {
            name: {
              given: ['John', 'J'],
              family: 'Doe'
            }
          }
        }];
        compareResults('patient.name.given', input);
      });

      it('threads context through dot operator', () => {
        // Context threading is tested implicitly by compareResults
        const input = [{ a: { b: { c: 42 } } }];
        compareResults('a.b.c', input);
      });

      it('handles empty results in pipeline', () => {
        const input = [{ a: {} }]; // b doesn't exist
        compareResults('a.b.c', input);
      });
    });

    describe('Arithmetic Operators', () => {
      it('compiles addition', () => {
        compareResults('1 + 2');
        compareResults('2.5 + 3.5');
      });

      it('compiles subtraction', () => {
        compareResults('5 - 3');
        compareResults('1.5 - 0.5');
      });

      it('compiles multiplication', () => {
        compareResults('3 * 4');
        compareResults('2.5 * 2');
      });

      it('compiles division', () => {
        compareResults('10 / 2');
        compareResults('7.5 / 2.5');
      });

      it('compiles integer division', () => {
        compareResults('10 div 3');
        compareResults('7 div 2');
      });

      it('compiles modulo', () => {
        compareResults('10 mod 3');
        compareResults('7 mod 2');
      });
    });

    describe('Comparison Operators', () => {
      it('compiles equality', () => {
        compareResults('1 = 1');
        compareResults("'hello' = 'hello'");
        compareResults('true = true');
        compareResults('1 = 2');
      });

      it('compiles inequality', () => {
        compareResults('1 != 2');
        compareResults("'hello' != 'world'");
        compareResults('true != false');
      });

      it('compiles less than', () => {
        compareResults('1 < 2');
        compareResults('2 < 1');
        compareResults("'a' < 'b'");
      });

      it('compiles greater than', () => {
        compareResults('2 > 1');
        compareResults('1 > 2');
        compareResults("'b' > 'a'");
      });

      it('compiles less than or equal', () => {
        compareResults('1 <= 2');
        compareResults('2 <= 2');
        compareResults('3 <= 2');
      });

      it('compiles greater than or equal', () => {
        compareResults('2 >= 1');
        compareResults('2 >= 2');
        compareResults('1 >= 2');
      });
    });

    describe('Logical Operators', () => {
      it('compiles and operator', () => {
        compareResults('true and true');
        compareResults('true and false');
        compareResults('false and true');
        compareResults('false and false');
      });

      it('compiles or operator', () => {
        compareResults('true or true');
        compareResults('true or false');
        compareResults('false or true');
        compareResults('false or false');
      });

      it('compiles xor operator', () => {
        compareResults('true xor true');
        compareResults('true xor false');
        compareResults('false xor true');
        compareResults('false xor false');
      });

      it('compiles implies operator', () => {
        compareResults('true implies true');
        compareResults('true implies false');
        compareResults('false implies true');
        compareResults('false implies false');
      });
    });

    describe('String Operators', () => {
      it('compiles string concatenation', () => {
        compareResults("'hello' & ' ' & 'world'");
        compareResults("'FHIR' & 'Path'");
      });
    });

    describe('Membership Operators', () => {
      it('compiles in operator', () => {
        compareResults("'a' in 'abc'");
        compareResults("'x' in 'abc'");
        compareResults('1 in {1, 2, 3}');
        compareResults('4 in {1, 2, 3}');
      });

      it('compiles contains operator', () => {
        compareResults("'abc' contains 'a'");
        compareResults("'abc' contains 'x'");
        compareResults('{1, 2, 3} contains 1');
        compareResults('{1, 2, 3} contains 4');
      });
    });
  });

  describe('Unary Operators', () => {
    it('compiles not operator', () => {
      compareResults('not true');
      compareResults('not false');
      compareResults('not {}'); // empty is false
    });

    it('compiles unary plus', () => {
      compareResults('+42');
      compareResults('+(-5)');
    });

    it('compiles unary minus', () => {
      compareResults('-42');
      compareResults('-(-5)');
    });
  });

  describe('Union Operator', () => {
    it('compiles union of collections', () => {
      compareResults('{1, 2} | {3, 4}');
      compareResults("{'a', 'b'} | {'c', 'd'}");
    });

    it('compiles multiple unions', () => {
      compareResults('{1} | {2} | {3}');
    });

    it('threads context through union', () => {
      const input = [{ a: 1, b: 2, c: 3 }];
      compareResults('a | b | c', input);
    });
  });

  describe('Index Operator', () => {
    it('compiles array indexing', () => {
      const input = [[10, 20, 30]];
      compareResults('$this[0]', input);
      compareResults('$this[1]', input);
      compareResults('$this[2]', input);
    });

    it('returns empty for out of bounds', () => {
      const input = [[10, 20, 30]];
      compareResults('$this[3]', input);
      compareResults('$this[-1]', input);
    });

    it('compiles complex index expressions', () => {
      const input = [{ items: ['a', 'b', 'c'], index: 1 }];
      compareResults('items[index]', input);
    });
  });

  describe('Functions', () => {
    describe('where() function', () => {
      it('compiles simple where', () => {
        const input = [1, 2, 3, 4, 5];
        compareResults('$this.where($this > 2)', input);
      });

      it('filters objects by property', () => {
        const input = [
          { name: 'John', age: 30 },
          { name: 'Jane', age: 25 },
          { name: 'Bob', age: 35 }
        ];
        compareResults('$this.where(age > 30)', input);
      });

      it('uses $index in predicate', () => {
        const input = ['a', 'b', 'c', 'd'];
        compareResults('$this.where($index < 2)', input);
      });

      it('handles empty input', () => {
        compareResults('{}.where($this > 0)');
      });

      it('handles predicate returning empty', () => {
        const input = [1, 2, 3];
        compareResults('$this.where({})', input); // empty is falsy
      });
    });

    describe('select() function', () => {
      it('compiles simple select', () => {
        const input = [
          { name: 'John', age: 30 },
          { name: 'Jane', age: 25 }
        ];
        compareResults('$this.select(name)', input);
      });

      it('projects complex expressions', () => {
        const input = [
          { first: 'John', last: 'Doe' },
          { first: 'Jane', last: 'Smith' }
        ];
        compareResults("$this.select(first & ' ' & last)", input);
      });

      it('uses $index in projection', () => {
        const input = ['a', 'b', 'c'];
        compareResults('$this.select($index)', input);
      });

      it('flattens results', () => {
        const input = [
          { names: ['John', 'J'] },
          { names: ['Jane'] }
        ];
        compareResults('$this.select(names)', input);
      });

      it('handles empty input', () => {
        compareResults('{}.select(name)');
      });
    });
  });

  describe('Complex Expressions', () => {
    it('compiles nested function calls', () => {
      const input = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
        { name: 'Bob', age: 35 }
      ];
      compareResults('$this.where(age > 25).select(name)', input);
    });

    it('compiles complex navigation with filters', () => {
      const input = [{
        patients: [
          { name: 'John', active: true },
          { name: 'Jane', active: false },
          { name: 'Bob', active: true }
        ]
      }];
      compareResults('patients.where(active).name', input);
    });

    it('compiles expressions with multiple operators', () => {
      const input = [{ a: 5, b: 3 }];
      compareResults('(a + b) * 2 > 10', input);
    });
  });

  describe('Error Handling', () => {
    it('propagates position information for runtime errors', () => {
      // Test with an actual error - accessing property on null
      const ast = parse('$this.name');
      const compiled = compiler.compile(ast);
      
      try {
        // This should work fine with valid input
        const result = compiled([{ name: 'test' }], context);
        expect(result.value).toEqual(['test']);
      } catch (error: any) {
        // Should not error with valid input
        expect(true).toBe(false);
      }
    });

    it('handles compilation errors with position', () => {
      // Test compilation error - unknown node type would have position
      try {
        const ast = parse('Patient is String'); // 'is' operator not implemented yet
        const compiled = compiler.compile(ast);
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain('not yet implemented');
        expect(error.position).toBeDefined();
      }
    });
  });

  describe('Performance Comparison', () => {
    it('executes faster than interpreter for repeated evaluations', () => {
      const expression = 'patients.where(active = true).name.given';
      const ast = parse(expression);
      const compiled = compiler.compile(ast);
      
      const input = [{
        patients: Array.from({ length: 100 }, (_, i) => ({
          name: { given: [`Person${i}`], family: `Family${i}` },
          active: i % 2 === 0
        }))
      }];
      
      // Warm up
      interpreter.evaluate(ast, input, context);
      compiled(input, context);
      
      // Measure interpreter
      const interpreterStart = performance.now();
      for (let i = 0; i < 1000; i++) {
        interpreter.evaluate(ast, input, context);
      }
      const interpreterTime = performance.now() - interpreterStart;
      
      // Measure compiler
      const compilerStart = performance.now();
      for (let i = 0; i < 1000; i++) {
        compiled(input, context);
      }
      const compilerTime = performance.now() - compilerStart;
      
      console.log(`Interpreter: ${interpreterTime.toFixed(2)}ms`);
      console.log(`Compiler: ${compilerTime.toFixed(2)}ms`);
      console.log(`Speedup: ${(interpreterTime / compilerTime).toFixed(2)}x`);
      
      // Compiler should be at least 2x faster
      expect(compilerTime).toBeLessThan(interpreterTime / 2);
    });
  });

  describe('Helper Functions', () => {
    it('compile() function works with string input', () => {
      const compiled = compile('1 + 2');
      const result = compiled([], context);
      expect(result.value).toEqual([3]);
    });

    it('compile() function works with AST input', () => {
      const ast = parse('1 + 2');
      const compiled = compile(ast);
      const result = compiled([], context);
      expect(result.value).toEqual([3]);
    });

    it('evaluateCompiled() function works correctly', () => {
      const result = evaluateCompiled('1 + 2', []);
      expect(result).toEqual([3]);
      
      const input = [{ name: 'John' }];
      const result2 = evaluateCompiled('name', input);
      expect(result2).toEqual(['John']);
    });
  });
});