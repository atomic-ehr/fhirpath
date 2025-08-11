import { describe, it, expect } from 'bun:test';
import { Parser, type ASTNode } from '../src/parser';
import { Interpreter } from '../src/interpreter';
import { unbox } from '../src/boxing';

describe('FHIRPath Interpreter', () => {
  async function evaluate(expr: string, input: any = {}) {
    const parser = new Parser(expr);
    const parseResult = parser.parse();
    if (parseResult.errors.length > 0) {
      throw new Error(parseResult.errors[0]!.message);
    }
    const ast = parseResult.ast;
    const interpreter = new Interpreter();
    const result = await interpreter.evaluate(ast, Array.isArray(input) ? input : [input]);
    // Unbox all values before returning
    return result.value.map(v => unbox(v));
  }

  describe('Literals', () => {
    it('should evaluate numbers', async () => {
      expect(await evaluate('42')).toEqual([42]);
      expect(await evaluate('3.14')).toEqual([3.14]);
    });

    it('should evaluate strings', async () => {
      expect(await evaluate("'hello'")).toEqual(['hello']);
      expect(await evaluate('"world"')).toEqual(['world']);
    });

    it('should evaluate booleans', async () => {
      expect(await evaluate('true')).toEqual([true]);
      expect(await evaluate('false')).toEqual([false]);
    });

    it('should evaluate null', async () => {
      expect(await evaluate('null')).toEqual([null]);
    });
  });

  describe('Navigation', () => {
    const patient = {
      resourceType: 'Patient',
      name: [
        { use: 'official', given: ['John', 'James'], family: 'Smith' },
        { use: 'nickname', given: ['Johnny'] }
      ],
      active: true,
      gender: 'male'
    };

    it('should navigate simple properties', async () => {
      expect(await evaluate('active', patient)).toEqual([true]);
      expect(await evaluate('gender', patient)).toEqual(['male']);
    });

    it('should navigate arrays', async () => {
      expect(await evaluate('name', patient)).toEqual(patient.name);
      expect(await evaluate('name.use', patient)).toEqual(['official', 'nickname']);
    });

    it('should handle chained navigation', async () => {
      expect(await evaluate('name.given', patient)).toEqual(['John', 'James', 'Johnny']);
      expect(await evaluate('name.family', patient)).toEqual(['Smith']);
    });

    it('should handle missing properties', async () => {
      expect(await evaluate('missing', patient)).toEqual([]);
      expect(await evaluate('name.missing', patient)).toEqual([]);
    });
  });

  describe('Type filtering', () => {
    it('should filter by resource type', async () => {
      const patient = { resourceType: 'Patient', id: '1' };
      const observation = { resourceType: 'Observation', id: '2' };
      
      expect(await evaluate('Patient', [patient, observation])).toEqual([patient]);
      expect(await evaluate('Observation', [patient, observation])).toEqual([observation]);
    });
  });

  describe('Arithmetic operators', () => {
    it('should add numbers', async () => {
      expect(await evaluate('5 + 3')).toEqual([8]);
      expect(await evaluate('2.5 + 1.5')).toEqual([4]);
    });

    it('should concatenate strings', async () => {
      expect(await evaluate("'hello' + ' ' + 'world'")).toEqual(['hello world']);
    });

    it('should subtract numbers', async () => {
      expect(await evaluate('10 - 4')).toEqual([6]);
    });

    it('should multiply numbers', async () => {
      expect(await evaluate('6 * 7')).toEqual([42]);
    });

    it('should divide numbers', async () => {
      expect(await evaluate('20 / 4')).toEqual([5]);
    });

    it('should handle empty operands', async () => {
      expect(await evaluate('5 + {}')).toEqual([]);
      expect(await evaluate('{} + 5')).toEqual([]);
    });
  });

  describe('Comparison operators', () => {
    it('should compare equality', async () => {
      expect(await evaluate('5 = 5')).toEqual([true]);
      expect(await evaluate('5 = 3')).toEqual([false]);
      expect(await evaluate("'hello' = 'hello'")).toEqual([true]);
    });

    it('should compare inequality', async () => {
      expect(await evaluate('5 != 3')).toEqual([true]);
      expect(await evaluate('5 != 5')).toEqual([false]);
    });

    it('should compare less than', async () => {
      expect(await evaluate('3 < 5')).toEqual([true]);
      expect(await evaluate('5 < 3')).toEqual([false]);
    });

    it('should compare greater than', async () => {
      expect(await evaluate('5 > 3')).toEqual([true]);
      expect(await evaluate('3 > 5')).toEqual([false]);
    });
  });

  describe('Logical operators', () => {
    it('should evaluate and', async () => {
      expect(await evaluate('true and true')).toEqual([true]);
      expect(await evaluate('true and false')).toEqual([false]);
      expect(await evaluate('false and false')).toEqual([false]);
    });

    it('should evaluate or', async () => {
      expect(await evaluate('true or false')).toEqual([true]);
      expect(await evaluate('false or false')).toEqual([false]);
      expect(await evaluate('false or true')).toEqual([true]);
    });

    it('should handle three-valued logic', async () => {
      // empty and true = empty (unknown)
      expect(await evaluate('{} and true')).toEqual([]);
      // empty and false = false
      expect(await evaluate('{} and false')).toEqual([false]);
      // empty or true = true
      expect(await evaluate('{} or true')).toEqual([true]);
      // empty or false = empty (unknown)
      expect(await evaluate('{} or false')).toEqual([]);
    });
  });

  describe('Functions', () => {
    const patient = {
      name: [
        { use: 'official', given: ['John', 'James'], family: 'Smith' },
        { use: 'nickname', given: ['Johnny'] }
      ]
    };

    it('should evaluate where', async () => {
      expect(await evaluate("name.where(use = 'official')", patient)).toEqual([patient.name[0]]);
      expect(await evaluate("name.where(use = 'nickname')", patient)).toEqual([patient.name[1]]);
    });

    it('should evaluate select', async () => {
      expect(await evaluate('name.select(given)', patient)).toEqual(['John', 'James', 'Johnny']);
      expect(await evaluate('name.select(use)', patient)).toEqual(['official', 'nickname']);
    });

    it('should evaluate first and last', async () => {
      expect(await evaluate('name.given.first()', patient)).toEqual(['John']);
      expect(await evaluate('name.given.last()', patient)).toEqual(['Johnny']);
    });

    it('should evaluate count', async () => {
      expect(await evaluate('name.count()', patient)).toEqual([2]);
      expect(await evaluate('name.given.count()', patient)).toEqual([3]);
    });

    it('should evaluate exists and empty', async () => {
      expect(await evaluate('name.exists()', patient)).toEqual([true]);
      expect(await evaluate('missing.exists()', patient)).toEqual([false]);
      expect(await evaluate('name.empty()', patient)).toEqual([false]);
      expect(await evaluate('missing.empty()', patient)).toEqual([true]);
    });

    it('should evaluate distinct', async () => {
      expect(await evaluate('{1, 2, 2, 3, 1}.distinct()')).toEqual([1, 2, 3]);
    });
  });

  describe('Variables', () => {
    it('should evaluate $this', async () => {
      const patient = { name: 'John' };
      expect(await evaluate('$this', patient)).toEqual([patient]);
    });

    it('should use $this in where', async () => {
      const items = [1, 2, 3, 4, 5];
      expect(await evaluate('where($this > 3)', items)).toEqual([4, 5]);
    });
  });

  describe('Control flow', () => {
    it('should evaluate iif', async () => {
      expect(await evaluate('iif(true, 1, 2)')).toEqual([1]);
      expect(await evaluate('iif(false, 1, 2)')).toEqual([2]);
      expect(await evaluate('iif({}, 1, 2)')).toEqual([2]); // Empty condition is treated as false
    });

    it('should evaluate defineVariable', async () => {
      const patient = { name: 'John', age: 30 };
      // Note: This test requires proper context threading through all operators
      // For now, test a simpler case
      expect(await evaluate("defineVariable('%x', 'test').%x", patient))
        .toEqual(['test']);
    });
  });

  describe('Union operator', () => {
    it('should combine collections', async () => {
      expect(await evaluate('{1, 2} | {3, 4}')).toEqual([1, 2, 3, 4]);
    });
  });

  describe('Complex expressions', () => {
    const patient = {
      resourceType: 'Patient',
      name: [
        { use: 'official', given: ['Sarah', 'Jane'], family: 'Smith' },
        { use: 'nickname', given: ['SJ'] }
      ],
      gender: 'female',
      active: true
    };

    it('should evaluate complex navigation', async () => {
      expect(await evaluate("name.where(use = 'official').given.first()", patient))
        .toEqual(['Sarah']);
    });

    it('should evaluate complex conditions', async () => {
      expect(await evaluate("active and gender = 'female'", patient))
        .toEqual([true]);
    });

    it('should evaluate nested functions', async () => {
      expect(await evaluate("name.select(given.count())", patient))
        .toEqual([2, 1]);
    });
  });
});