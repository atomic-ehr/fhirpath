import { describe, it, expect, beforeEach } from 'bun:test';
import { Interpreter } from '../src/interpreter/interpreter';
import { ContextManager } from '../src/interpreter/context';
import { parse } from '../src/parser';

describe('FHIRPath Interpreter', () => {
  let interpreter: Interpreter;
  let context: any;

  beforeEach(() => {
    interpreter = new Interpreter();
    context = ContextManager.create();
  });

  describe('Phase 2: Simple Nodes', () => {
    describe('Literals', () => {
      it('evaluates number literals', () => {
        const ast = parse('42');
        const result = interpreter.evaluate(ast, [], context);
        expect(result.value).toEqual([42]);
        expect(result.context).toBe(context); // Context unchanged
      });

      it('evaluates string literals', () => {
        const ast = parse("'hello'");
        const result = interpreter.evaluate(ast, [], context);
        expect(result.value).toEqual(['hello']);
      });

      it('evaluates boolean literals', () => {
        const ast1 = parse('true');
        const result1 = interpreter.evaluate(ast1, [], context);
        expect(result1.value).toEqual([true]);

        const ast2 = parse('false');
        const result2 = interpreter.evaluate(ast2, [], context);
        expect(result2.value).toEqual([false]);
      });

      it('evaluates empty collection', () => {
        const ast = parse('{}');
        const result = interpreter.evaluate(ast, [], context);
        expect(result.value).toEqual([]);
      });

      it('evaluates collection literals', () => {
        const ast = parse('{1, 2, 3}');
        const result = interpreter.evaluate(ast, [], context);
        expect(result.value).toEqual([1, 2, 3]);
      });

      it('evaluates null literal as empty collection', () => {
        const ast = parse('null');
        const result = interpreter.evaluate(ast, [], context);
        expect(result.value).toEqual([]);
      });
    });

    describe('Identifiers - Property Navigation', () => {
      it('navigates simple property', () => {
        const input = [{ name: 'John' }];
        const ast = parse('name');
        const result = interpreter.evaluate(ast, input, context);
        expect(result.value).toEqual(['John']);
      });

      it('returns empty collection for missing property', () => {
        const input = [{ age: 30 }];
        const ast = parse('name');
        const result = interpreter.evaluate(ast, input, context);
        expect(result.value).toEqual([]);
      });

      it('navigates on multiple items', () => {
        const input = [
          { name: 'John' },
          { name: 'Jane' },
          { age: 30 } // no name
        ];
        const ast = parse('name');
        const result = interpreter.evaluate(ast, input, context);
        expect(result.value).toEqual(['John', 'Jane']);
      });

      it('flattens array properties', () => {
        const input = [{
          name: [
            { given: ['John', 'J'], family: 'Doe' },
            { given: ['Jane'], family: 'Smith' }
          ]
        }];
        const ast = parse('name');
        const result = interpreter.evaluate(ast, input, context);
        expect(result.value).toHaveLength(2);
        expect(result.value[0]).toHaveProperty('given');
        expect(result.value[1]).toHaveProperty('family', 'Smith');
      });
    });

    describe('Variables', () => {
      it('evaluates $this', () => {
        const ctxWithThis = ContextManager.setIteratorContext(context, 'test', 0);
        const ast = parse('$this');
        const result = interpreter.evaluate(ast, [], ctxWithThis);
        expect(result.value).toEqual(['test']);
      });

      it('evaluates $index', () => {
        const ctxWithIndex = ContextManager.setIteratorContext(context, 'item', 5);
        const ast = parse('$index');
        const result = interpreter.evaluate(ast, [], ctxWithIndex);
        expect(result.value).toEqual([5]);
      });

      it('evaluates %variable', () => {
        const ctxWithVar = ContextManager.setVariable(context, 'myVar', ['value1', 'value2']);
        const ast = parse('%myVar');
        const result = interpreter.evaluate(ast, [], ctxWithVar);
        expect(result.value).toEqual(['value1', 'value2']);
      });

      it('evaluates %context', () => {
        const input = [{ id: '123' }];
        const ctx = ContextManager.create(input);
        const ast = parse('%context');
        const result = interpreter.evaluate(ast, [], ctx);
        expect(result.value).toEqual(input);
      });

      it('returns empty for undefined variable', () => {
        const ast = parse('%undefinedVar');
        const result = interpreter.evaluate(ast, [], context);
        expect(result.value).toEqual([]);
      });
    });

    describe('Dot Operator - Pipeline', () => {
      it('pipelines data through expressions', () => {
        const input = [{ 
          patient: { 
            name: 'John' 
          } 
        }];
        const ast = parse('patient.name');
        const result = interpreter.evaluate(ast, input, context);
        expect(result.value).toEqual(['John']);
      });

      it('handles empty intermediate results', () => {
        const input = [{ patient: {} }];
        const ast = parse('patient.name.given');
        const result = interpreter.evaluate(ast, input, context);
        expect(result.value).toEqual([]);
      });

      it('threads context through pipeline', () => {
        // This will be tested more thoroughly when we implement defineVariable
        const input = [{ value: 5 }];
        const ast = parse('value'); // Simple for now
        const result = interpreter.evaluate(ast, input, context);
        expect(result.context).toBe(context); // Context preserved
      });
    });
  });

  describe('Phase 3: Operators', () => {
    describe('Arithmetic Operators', () => {
      it('evaluates addition', () => {
        const ast = parse('2 + 3');
        const result = interpreter.evaluate(ast, [], context);
        expect(result.value).toEqual([5]);
      });

      it('evaluates subtraction', () => {
        const ast = parse('5 - 3');
        const result = interpreter.evaluate(ast, [], context);
        expect(result.value).toEqual([2]);
      });

      it('evaluates multiplication', () => {
        const ast = parse('4 * 3');
        const result = interpreter.evaluate(ast, [], context);
        expect(result.value).toEqual([12]);
      });

      it('evaluates division', () => {
        const ast = parse('10 / 2');
        const result = interpreter.evaluate(ast, [], context);
        expect(result.value).toEqual([5]);
      });

      it('evaluates div (integer division)', () => {
        const ast = parse('7 div 3');
        const result = interpreter.evaluate(ast, [], context);
        expect(result.value).toEqual([2]);
      });

      it('evaluates mod', () => {
        const ast = parse('7 mod 3');
        const result = interpreter.evaluate(ast, [], context);
        expect(result.value).toEqual([1]);
      });

      it('applies singleton conversion rules', () => {
        const input = [{ value: 5 }];
        const ast = parse('value + 3');
        const result = interpreter.evaluate(ast, input, context);
        expect(result.value).toEqual([8]);
      });

      it('returns empty for operations with empty collections', () => {
        const ast = parse('missing + 5');
        const result = interpreter.evaluate(ast, [], context);
        expect(result.value).toEqual([]);
      });
    });

    describe('Comparison Operators', () => {
      it('evaluates equality', () => {
        const ast = parse('5 = 5');
        const result = interpreter.evaluate(ast, [], context);
        expect(result.value).toEqual([true]);
      });

      it('evaluates inequality', () => {
        const ast = parse('5 != 3');
        const result = interpreter.evaluate(ast, [], context);
        expect(result.value).toEqual([true]);
      });

      it('evaluates greater than', () => {
        const ast = parse('5 > 3');
        const result = interpreter.evaluate(ast, [], context);
        expect(result.value).toEqual([true]);
      });

      it('evaluates less than', () => {
        const ast = parse('3 < 5');
        const result = interpreter.evaluate(ast, [], context);
        expect(result.value).toEqual([true]);
      });

      it('compares strings', () => {
        const ast = parse("'apple' < 'banana'");
        const result = interpreter.evaluate(ast, [], context);
        expect(result.value).toEqual([true]);
      });

      it('returns empty for comparisons with empty', () => {
        const ast = parse('5 = {}');
        const result = interpreter.evaluate(ast, [], context);
        expect(result.value).toEqual([]);
      });
    });

    describe('Logical Operators', () => {
      it('evaluates and', () => {
        const ast = parse('true and true');
        const result = interpreter.evaluate(ast, [], context);
        expect(result.value).toEqual([true]);
      });

      it('evaluates or', () => {
        const ast = parse('true or false');
        const result = interpreter.evaluate(ast, [], context);
        expect(result.value).toEqual([true]);
      });

      it('evaluates not', () => {
        const ast = parse('not true');
        const result = interpreter.evaluate(ast, [], context);
        expect(result.value).toEqual([false]);
      });

      it('implements three-valued logic for and', () => {
        // true and {} → {}
        const ast1 = parse('true and {}');
        const result1 = interpreter.evaluate(ast1, [], context);
        expect(result1.value).toEqual([]);

        // false and {} → false
        const ast2 = parse('false and {}');
        const result2 = interpreter.evaluate(ast2, [], context);
        expect(result2.value).toEqual([false]);
      });

      it('implements three-valued logic for or', () => {
        // {} or {} → {}
        const ast1 = parse('{} or {}');
        const result1 = interpreter.evaluate(ast1, [], context);
        expect(result1.value).toEqual([]);

        // true or {} → true
        const ast2 = parse('true or {}');
        const result2 = interpreter.evaluate(ast2, [], context);
        expect(result2.value).toEqual([true]);
      });
    });
  });

  describe('Task 006: Union and Functions', () => {
    describe('Collection Equality', () => {
      it('compares single-item collections', () => {
        const input = [{ name: { given: ['John'] } }];
        const ast = parse("name.given = 'John'");
        const result = interpreter.evaluate(ast, input, context);
        expect(result.value).toEqual([true]);
      });

      it('compares multi-item collections', () => {
        const ast1 = parse("{1, 2, 3} = {1, 2, 3}");
        const result1 = interpreter.evaluate(ast1, [], context);
        expect(result1.value).toEqual([true]);

        const ast2 = parse("{1, 2, 3} = {1, 3, 2}");
        const result2 = interpreter.evaluate(ast2, [], context);
        expect(result2.value).toEqual([false]); // Order matters
      });

      it('handles inequality with collections', () => {
        const ast = parse("{1, 2} != {1, 2, 3}");
        const result = interpreter.evaluate(ast, [], context);
        expect(result.value).toEqual([true]);
      });

      it('returns empty for comparisons with empty', () => {
        const ast1 = parse("{1, 2} = {}");
        const result1 = interpreter.evaluate(ast1, [], context);
        expect(result1.value).toEqual([]);

        const ast2 = parse("{} != {1, 2}");
        const result2 = interpreter.evaluate(ast2, [], context);
        expect(result2.value).toEqual([]);
      });

      it('uses singleton conversion for single items', () => {
        // name.given returns ['John'], but = 'John' should work
        const input = [{ name: { given: ['John'] } }];
        const ast = parse("name.given = 'John'");
        const result = interpreter.evaluate(ast, input, context);
        expect(result.value).toEqual([true]);
      });
    });

    describe('Union Operator', () => {
      it('combines results from multiple expressions', () => {
        const input = [{ 
          name: { 
            given: ['John', 'J'], 
            family: 'Doe' 
          }
        }];
        const ast = parse('name.given | name.family');
        const result = interpreter.evaluate(ast, input, context);
        expect(result.value).toEqual(['John', 'J', 'Doe']);
      });

      it('preserves order and duplicates', () => {
        const ast = parse('{1, 2} | {2, 3} | {1}');
        const result = interpreter.evaluate(ast, [], context);
        expect(result.value).toEqual([1, 2, 2, 3, 1]);
      });

      it('handles empty collections', () => {
        const ast = parse('{} | {1, 2} | {}');
        const result = interpreter.evaluate(ast, [], context);
        expect(result.value).toEqual([1, 2]);
      });

      it('threads context through operands', () => {
        // This will be more relevant when we implement defineVariable
        const input = [{ a: 1, b: 2, c: 3 }];
        const ast = parse('a | b | c');
        const result = interpreter.evaluate(ast, input, context);
        expect(result.value).toEqual([1, 2, 3]);
        expect(result.context).toBe(context); // For now, context unchanged
      });
    });

    describe('Functions', () => {
      describe('where()', () => {
        it('filters collection based on predicate', () => {
          const input = [{
            name: [
              { use: 'official', given: ['John'], family: 'Doe' },
              { use: 'nickname', given: ['Johnny'], family: 'D' }
            ]
          }];
          const ast = parse("name.where(use = 'official')");
          const result = interpreter.evaluate(ast, input, context);
          expect(result.value).toHaveLength(1);
          expect(result.value[0].use).toBe('official');
        });

        it('uses $this context', () => {
          const input = [{ values: [1, 2, 3, 4, 5] }];
          const ast = parse('values.where($this > 3)');
          const result = interpreter.evaluate(ast, input, context);
          expect(result.value).toEqual([4, 5]);
        });

        it('handles empty results', () => {
          const input = [{ values: [1, 2, 3] }];
          const ast = parse('values.where($this > 10)');
          const result = interpreter.evaluate(ast, input, context);
          expect(result.value).toEqual([]);
        });

        it('works with complex expressions', () => {
          const input = [{ 
            items: [
              { name: 'A', price: 10 },
              { name: 'B', price: 20 },
              { name: 'C', price: 15 }
            ]
          }];
          const ast = parse('items.where(price > 12 and price < 18)');
          const result = interpreter.evaluate(ast, input, context);
          expect(result.value).toHaveLength(1);
          expect(result.value[0].name).toBe('C');
        });
      });

      describe('select()', () => {
        it('transforms each item', () => {
          const input = [{
            name: [
              { given: ['John'], family: 'Doe' },
              { given: ['Jane'], family: 'Smith' }
            ]
          }];
          const ast = parse('name.select(given)');
          const result = interpreter.evaluate(ast, input, context);
          expect(result.value).toEqual(['John', 'Jane']);
        });

        it('flattens results', () => {
          const input = [{
            name: [
              { given: ['John', 'J'], family: 'Doe' },
              { given: ['Jane'], family: 'Smith' }
            ]
          }];
          const ast = parse('name.select(given)');
          const result = interpreter.evaluate(ast, input, context);
          expect(result.value).toEqual(['John', 'J', 'Jane']);
        });

        it('works with expressions', () => {
          const input = [{ values: [1, 2, 3] }];
          const ast = parse('values.select($this * 2)');
          const result = interpreter.evaluate(ast, input, context);
          expect(result.value).toEqual([2, 4, 6]);
        });

        it('can use union in select', () => {
          const input = [{
            name: [
              { given: ['John'], family: 'Doe' },
              { given: ['Jane'], family: 'Smith' }
            ]
          }];
          const ast = parse('name.select(given | family)');
          const result = interpreter.evaluate(ast, input, context);
          expect(result.value).toEqual(['John', 'Doe', 'Jane', 'Smith']);
        });
      });

      describe('iif()', () => {
        it('evaluates then branch when condition is true', () => {
          const input = [{ active: true }];
          const ast = parse("iif(active, 'Active', 'Inactive')");
          const result = interpreter.evaluate(ast, input, context);
          expect(result.value).toEqual(['Active']);
        });

        it('evaluates else branch when condition is false', () => {
          const input = [{ active: false }];
          const ast = parse("iif(active, 'Active', 'Inactive')");
          const result = interpreter.evaluate(ast, input, context);
          expect(result.value).toEqual(['Inactive']);
        });

        it('treats empty as false', () => {
          const input = [{}]; // No active property
          const ast = parse("iif(active, 'Active', 'Inactive')");
          const result = interpreter.evaluate(ast, input, context);
          expect(result.value).toEqual(['Inactive']);
        });

        it('only evaluates needed branch (lazy evaluation)', () => {
          const input = [{ value: 0 }];
          // Division by zero in else branch should not execute
          const ast = parse("iif(value != 0, 10 / value, 0)");
          const result = interpreter.evaluate(ast, input, context);
          expect(result.value).toEqual([0]);
        });

        it('propagates context from condition', () => {
          // This will be more meaningful with defineVariable
          const input = [{ x: 5 }];
          const ast = parse("iif(x > 0, x + 1, x - 1)");
          const result = interpreter.evaluate(ast, input, context);
          expect(result.value).toEqual([6]);
        });
      });

      describe('defineVariable()', () => {
        it('adds variable to context', () => {
          const input = [{ value: 5 }];
          // First test that defineVariable itself works
          const ast1 = parse("defineVariable('x', value)");
          const result1 = interpreter.evaluate(ast1, input, context);
          expect(result1.value).toEqual(input); // Should return original input
          expect(ContextManager.getVariable(result1.context, 'x')).toEqual([5]);

          // Now test using the variable
          const ast2 = parse("defineVariable('x', value).value + %x");
          const result2 = interpreter.evaluate(ast2, input, context);
          expect(result2.value).toEqual([10]); // 5 + 5
        });

        it('variable is available in subsequent expressions', () => {
          const input = [{ 
            name: [
              { use: 'official', given: ['John'] },
              { use: 'nickname', given: ['Johnny'] }
            ]
          }];
          const ast = parse(`
            defineVariable('officialName', name.where(use = 'official').first())
            .name.where(given != %officialName.given)
          `);
          const result = interpreter.evaluate(ast, input, context);
          expect(result.value).toHaveLength(1);
          expect(result.value[0].use).toBe('nickname');
        });

        it('returns original input', () => {
          const input = [{ a: 1, b: 2 }];
          const ast = parse("defineVariable('sum', a + b)");
          const result = interpreter.evaluate(ast, input, context);
          expect(result.value).toEqual(input); // Original input unchanged
        });

        it('can chain multiple defineVariable calls', () => {
          const input = [{ value: 5 }];
          const ast = parse(`
            defineVariable('x', value)
            .defineVariable('y', %x * 2)
            .defineVariable('z', %x + %y)
          `);
          const result = interpreter.evaluate(ast, input, context);
          expect(result.value).toEqual(input);
          // Context should have x=5, y=10, z=15
          const finalContext = result.context;
          expect(ContextManager.getVariable(finalContext, 'x')).toEqual([5]);
          expect(ContextManager.getVariable(finalContext, 'y')).toEqual([10]);
          expect(ContextManager.getVariable(finalContext, 'z')).toEqual([15]);
        });
      });
    });
  });
});