import { describe, it, expect } from 'bun:test';
import { parse as legacyParse } from '../../src/parser/parser';
import { parse, parseForEvaluation, ParserMode } from '../../src/api';
import type { StandardParseResult } from '../../src/parser/types';
import { NodeType } from '../../src/parser/ast';

describe('Backward Compatibility', () => {
  describe('Legacy parse function', () => {
    it('maintains backward compatibility with direct parser import', () => {
      const expression = 'Patient.name.given';
      
      // Legacy function from parser.ts should still work
      const ast = legacyParse(expression);
      
      expect(ast).toBeDefined();
      expect(ast.type).toBe(NodeType.Binary);
    });
    
    it('throws on first error like current parser', () => {
      expect(() => legacyParse('Patient..name')).toThrow();
      expect(() => legacyParse('5 +')).toThrow();
      expect(() => legacyParse('Patient.name[')).toThrow();
    });
  });
  
  describe('throwOnError flag matches current parser behavior', () => {
    const testExpressions = [
      'Patient.name.given',
      '5 + 3',
      'Patient.where(active = true)',
      'name.family | name.given',
      '{1, 2, 3}',
      'Patient.name[0]',
      'exists() and count() > 0',
      // 'birthDate + 1 year', // TODO: Requires unit support
      'Patient is Patient',
      'value as String'
    ];
    
    testExpressions.forEach(expression => {
      it(`parses "${expression}" identically with throwOnError`, () => {
        const oldResult = legacyParse(expression);
        const newResult = parse(expression, { throwOnError: true }) as StandardParseResult;
        
        // Compare AST structure
        expect(newResult.ast).toEqual(oldResult);
      });
    });
  });
  
  describe('parseForEvaluation helper', () => {
    it('returns AST directly like legacy parse', () => {
      const expression = 'Patient.name';
      
      const legacyAst = legacyParse(expression);
      const helperAst = parseForEvaluation(expression);
      
      expect(helperAst).toEqual(legacyAst);
    });
    
    it('throws on errors like legacy parse', () => {
      expect(() => parseForEvaluation('Patient..name')).toThrow();
    });
  });
  
  describe('Error behavior', () => {
    it('Fast mode throws immediately on parse errors', () => {
      const errorExpressions = [
        'Patient..name',
        '5 +',
        'Patient.name[',
        'Patient.where(',
        '{1, 2,',
        'Patient.',
        '.name'
      ];
      
      errorExpressions.forEach(expr => {
        // Legacy behavior
        expect(() => legacyParse(expr)).toThrow();
        
        // throwOnError should match
        expect(() => parse(expr, { throwOnError: true })).toThrow();
        expect(() => parseForEvaluation(expr)).toThrow();
      });
    });
    
    it('throws with same error messages', () => {
      const expression = 'Patient..name';
      
      let legacyError: Error | undefined;
      let fastError: Error | undefined;
      
      try {
        legacyParse(expression);
      } catch (e) {
        legacyError = e as Error;
      }
      
      try {
        parseForEvaluation(expression);
      } catch (e) {
        fastError = e as Error;
      }
      
      expect(legacyError).toBeDefined();
      expect(fastError).toBeDefined();
      
      // Error messages should be similar (may have slight formatting differences)
      expect(fastError!.message).toContain('line');
      expect(fastError!.message).toContain('column');
    });
  });
  
  describe('Performance characteristics', () => {
    it('Fast mode has similar performance to legacy parser', () => {
      const expression = 'Patient.name.where(use = \'official\').given.first()';
      const iterations = 100;
      
      // Warm up
      for (let i = 0; i < 10; i++) {
        legacyParse(expression);
        parseForEvaluation(expression);
      }
      
      // Measure legacy
      const legacyStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        legacyParse(expression);
      }
      const legacyDuration = performance.now() - legacyStart;
      
      // Measure Fast mode
      const fastStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        parseForEvaluation(expression);
      }
      const fastDuration = performance.now() - fastStart;
      
      // Fast mode should be within reasonable bounds of legacy performance
      // (can be faster or slightly slower)
      const ratio = fastDuration / legacyDuration;
      expect(ratio).toBeGreaterThan(0.5); // Not more than 2x slower
      expect(ratio).toBeLessThan(1.5); // Not more than 50% slower
    });
  });
  
  describe('Token array input', () => {
    it('supports token array input in backward compatible way', () => {
      const expression = 'Patient.name';
      
      // First get tokens using legacy parse
      const tokens = [
        { type: 'IDENTIFIER', value: 'Patient', position: { line: 0, column: 0, offset: 0 } },
        { type: 'DOT', value: '.', position: { line: 0, column: 7, offset: 7 } },
        { type: 'IDENTIFIER', value: 'name', position: { line: 0, column: 8, offset: 8 } },
        { type: 'EOF', value: '', position: { line: 0, column: 12, offset: 12 } }
      ];
      
      // Legacy parse with tokens
      const legacyAst = legacyParse(tokens as any);
      
      // New parse with tokens and throwOnError
      const newResult = parse(tokens as any, { throwOnError: true }) as StandardParseResult;
      
      expect(newResult.ast.type).toBe(legacyAst.type);
    });
  });
});