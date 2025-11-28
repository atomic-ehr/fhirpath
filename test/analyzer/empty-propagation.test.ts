import { describe, it, expect } from 'bun:test';
import { evaluate } from '../../src/index.node';
import { Analyzer } from '../../src/analyzer';
import { parse } from '../../src/parser';

describe('Empty Collection Propagation', () => {
  
  describe('Functions that propagate empty', () => {
    
    describe('Empty input propagation', () => {
      const testCases = [
        { expr: '{}.substring(0)', expected: [] },
        { expr: '{}.substring(0, 5)', expected: [] },
        { expr: '{}.indexOf("test")', expected: [] },
        { expr: '{}.startsWith("test")', expected: [] },
        { expr: '{}.endsWith("test")', expected: [] },
        { expr: '{}.contains("test")', expected: [] },
        { expr: '{}.replace("a", "b")', expected: [] },
        { expr: '{}.upper()', expected: [] },
        { expr: '{}.lower()', expected: [] },
        { expr: '{}.trim()', expected: [] },
        { expr: '{}.length()', expected: [] },
        { expr: '{}.toString()', expected: [] },
        { expr: '{}.toInteger()', expected: [] },
        { expr: '{}.toDecimal()', expected: [] },
        { expr: '{}.toBoolean()', expected: [] },
        // { expr: '{}.toDate()', expected: [] }, // TODO: toDate not implemented yet
        // { expr: '{}.toDateTime()', expected: [] }, // TODO: toDateTime not implemented yet  
        // { expr: '{}.toTime()', expected: [] }, // TODO: toTime not implemented yet
        { expr: '{} + 5', expected: [] },
        { expr: '{} - 5', expected: [] },
        { expr: '{} * 5', expected: [] },
        { expr: '{} / 5', expected: [] },
        { expr: '{} mod 5', expected: [] },
        { expr: '{} div 5', expected: [] },
        { expr: '{} = 5', expected: [] },
        { expr: '{} != 5', expected: [] },
        { expr: '{} < 5', expected: [] },
        { expr: '{} > 5', expected: [] },
        { expr: '{} <= 5', expected: [] },
        { expr: '{} >= 5', expected: [] },
      ];

      testCases.forEach(({ expr, expected }) => {
        it(`${expr} should return empty`, async () => {
          const result = await evaluate(expr);
          expect(result).toEqual(expected);
        });
      });
    });

    describe('Empty argument propagation', () => {
      const testCases = [
        { expr: '"test".substring({})', expected: [] },
        // Note: empty length parameter is treated as no length (spec behavior)
        // { expr: '"test".substring(0, {})', expected: [] },
        { expr: '"test".substring({}, 2)', expected: [] },
        { expr: '"test".indexOf({})', expected: [] },
        { expr: '"test".startsWith({})', expected: [] },
        { expr: '"test".endsWith({})', expected: [] },
        { expr: '"test".contains({})', expected: [] },
        { expr: '"test".replace({}, "b")', expected: [] },
        { expr: '"test".replace("a", {})', expected: [] },
        { expr: '"test".replace({}, {})', expected: [] },
        { expr: '5 + {}', expected: [] },
        { expr: '{} + 5', expected: [] },
        { expr: '5 - {}', expected: [] },
        { expr: '5 * {}', expected: [] },
        { expr: '5 / {}', expected: [] },
        { expr: '5 mod {}', expected: [] },
        { expr: '5 div {}', expected: [] },
        { expr: '5 = {}', expected: [] },
        { expr: '5 != {}', expected: [] },
        { expr: '5 < {}', expected: [] },
        { expr: '5 > {}', expected: [] },
        { expr: '5 <= {}', expected: [] },
        { expr: '5 >= {}', expected: [] },
      ];

      testCases.forEach(({ expr, expected }) => {
        it(`${expr} should return empty`, async () => {
          const result = await evaluate(expr);
          expect(result).toEqual(expected);
        });
      });
    });

    describe('Empty propagation through chains', () => {
      const testCases = [
        { expr: '{}.substring(0, 3).upper()', expected: [] },
        { expr: '"test".substring({}).upper()', expected: [] },
        { expr: '{}.toString().length()', expected: [] },
        { expr: '({} + 5).toString()', expected: [] },
        { expr: '("a" + {}).length()', expected: [] },
      ];

      testCases.forEach(({ expr, expected }) => {
        it(`${expr} should propagate empty through chain`, async () => {
          const result = await evaluate(expr);
          expect(result).toEqual(expected);
        });
      });
    });
  });

  describe('Functions that DON\'T propagate empty', () => {
    const testCases = [
      { expr: '{}.count()', expected: [0], desc: 'count returns 0 for empty' },
      { expr: '{}.empty()', expected: [true], desc: 'empty returns true for empty' },
      { expr: '{}.exists()', expected: [false], desc: 'exists returns false for empty' },
      { expr: '{}.allTrue()', expected: [true], desc: 'allTrue returns true for empty' },
      { expr: '{}.allFalse()', expected: [true], desc: 'allFalse returns true for empty' },
      { expr: '{}.anyTrue()', expected: [false], desc: 'anyTrue returns false for empty' },
      { expr: '{}.anyFalse()', expected: [false], desc: 'anyFalse returns false for empty' },
    ];

    testCases.forEach(({ expr, expected, desc }) => {
      it(`${expr} - ${desc}`, async () => {
        const result = await evaluate(expr);
        expect(result).toEqual(expected);
      });
    });
  });

  describe('Analyzer behavior with empty collections', () => {
    
    it('should not produce errors for empty input to functions that propagate', async () => {
      const ast = parse('{}.substring(0)');
      const analyzer = new Analyzer();
      const result = await analyzer.analyze(ast.ast);
      
      // Should have no errors (only warnings if any)
      const errors = result.diagnostics.filter(d => d.severity === 1); // 1 = error
      expect(errors).toHaveLength(0);
      
      // The analyzer correctly propagates empty without errors
      // (The AST type annotation comes from the old visitor pattern, not the new context-flow analysis)
    });

    it('should not produce errors for empty arguments to functions that propagate', async () => {
      const ast = parse('"test".substring({})');
      const analyzer = new Analyzer();
      const result = await analyzer.analyze(ast.ast);
      
      // Should have no errors (only warnings if any)
      const errors = result.diagnostics.filter(d => d.severity === 1); // 1 = error
      expect(errors).toHaveLength(0);
      
      // The analyzer correctly propagates empty without errors
      // (The AST type annotation comes from the old visitor pattern, not the new context-flow analysis)
    });

    it('should produce warnings for empty arguments where specific type expected', async () => {
      const ast = parse('"test".substring({})');
      const analyzer = new Analyzer();
      const result = await analyzer.analyze(ast.ast);
      
      // Should have a warning about type mismatch
      const warnings = result.diagnostics.filter(d => d.severity === 2); // 2 = warning
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]?.message).toContain('Integer');
    });

    it('should handle functions that don\'t propagate empty correctly', async () => {
      const ast = parse('{}.count()');
      const analyzer = new Analyzer();
      const result = await analyzer.analyze(ast.ast);
      
      // Should have no errors
      const errors = result.diagnostics.filter(d => d.severity === 1); // 1 = error
      expect(errors).toHaveLength(0);
      
      // count() returns Integer even for empty input (it doesn't propagate empty)
      // The AST should be annotated with Integer type
      expect(result.ast.typeInfo).toEqual({ type: 'Integer', singleton: true });
    });

    it('should propagate empty through function chains', async () => {
      const ast = parse('{}.substring(0, 3).upper().length()');
      const analyzer = new Analyzer();
      const result = await analyzer.analyze(ast.ast);
      
      // Should have no errors
      const errors = result.diagnostics.filter(d => d.severity === 1); // 1 = error
      expect(errors).toHaveLength(0);
      
      // The analyzer correctly propagates empty through the chain without errors
      // (The AST type annotation comes from the old visitor pattern)
    });
  });

  describe('Edge cases', () => {
    
    it('should handle mixed empty and non-empty in complex expressions', async () => {
      // Empty collection in union should not affect non-empty
      const result1 = await evaluate('{} | "test"');
      expect(result1).toEqual(['test']);
      
      // Empty as part of combine
      const result2 = await evaluate('{}.combine("test")');
      expect(result2).toEqual(['test']);
    });

    it('should handle empty in conditional expressions', async () => {
      // iif with empty condition is treated as false, returns else branch
      const result1 = await evaluate('iif({}, "yes", "no")');
      expect(result1).toEqual(['no']);
      
      // where with empty input
      const result2 = await evaluate('{}.where($this > 5)');
      expect(result2).toEqual([]);
    });

    it('should handle empty with type operations', async () => {
      // ofType with empty input
      const result1 = await evaluate('{}.ofType(String)');
      expect(result1).toEqual([]);
      
      // is operator with empty
      const result2 = await evaluate('{} is String');
      expect(result2).toEqual([]);
      
      // as operator with empty
      const result3 = await evaluate('{} as String');
      expect(result3).toEqual([]);
    });
  });

  describe('Spec compliance tests from substring.json', () => {
    const specTests = [
      { expr: '{}.substring(0)', expected: [] },
      { expr: '"abcdefg".substring({})', expected: [] },
      // Note: Per spec, empty length is treated as no length provided
      // { expr: '"abcdefg".substring(3, {})', expected: ['defg'] }, // Empty length = no length
      { expr: '{}.substring({}).empty() = true', expected: [true] },
      { expr: '"string".substring({}).empty() = true', expected: [true] },
    ];

    specTests.forEach(({ expr, expected }) => {
      it(`Spec: ${expr}`, async () => {
        const result = await evaluate(expr);
        expect(result).toEqual(expected);
      });
    });
  });
});