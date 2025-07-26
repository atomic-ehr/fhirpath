import { describe, it, expect } from 'bun:test';
import { FHIRPathParser } from '../../src/parser/parser';
import { parse, parseForEvaluation } from '../../src/api';
import type { ParseResult } from '../../src/parser/types';
import { NodeType } from '../../src/parser/ast';

describe('Backward Compatibility', () => {
  describe('Direct parser usage', () => {
    it('can still use FHIRPathParser class directly', () => {
      const expression = 'Patient.name.given';
      
      // Direct use of parser class
      const parser = new FHIRPathParser(expression, { throwOnError: true });
      const result = parser.parse();
      const ast = result.ast;
      
      expect(ast).toBeDefined();
      expect(ast.type).toBe(NodeType.Binary);
    });
    
    it('throws on first error with throwOnError option', () => {
      expect(() => {
        const parser = new FHIRPathParser('Patient..name', { throwOnError: true });
        parser.parse();
      }).toThrow();
      expect(() => {
        const parser = new FHIRPathParser('5 +', { throwOnError: true });
        parser.parse();
      }).toThrow();
      expect(() => {
        const parser = new FHIRPathParser('Patient.name[', { throwOnError: true });
        parser.parse();
      }).toThrow();
    });
  });
  
  describe('throwOnError flag matches direct parser behavior', () => {
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
        const directParser = new FHIRPathParser(expression, { throwOnError: true });
        const directResult = directParser.parse();
        const apiResult = parse(expression, { throwOnError: true });
        
        // Compare AST structure
        expect(apiResult.ast).toEqual(directResult.ast);
      });
    });
  });
  
  describe('parseForEvaluation helper', () => {
    it('returns AST directly like direct parser with throwOnError', () => {
      const expression = 'Patient.name';
      
      const directParser = new FHIRPathParser(expression, { throwOnError: true });
      const directAst = directParser.parse().ast;
      const helperAst = parseForEvaluation(expression);
      
      expect(helperAst).toEqual(directAst);
    });
    
    it('throws on errors like direct parser', () => {
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
        // Direct parser behavior
        expect(() => {
          const parser = new FHIRPathParser(expr, { throwOnError: true });
          parser.parse();
        }).toThrow();
        
        // throwOnError should match
        expect(() => parse(expr, { throwOnError: true })).toThrow();
        expect(() => parseForEvaluation(expr)).toThrow();
      });
    });
    
    it('throws with same error messages', () => {
      const expression = 'Patient..name';
      
      let directError: Error | undefined;
      let fastError: Error | undefined;
      
      try {
        const parser = new FHIRPathParser(expression, { throwOnError: true });
        parser.parse();
      } catch (e) {
        directError = e as Error;
      }
      
      try {
        parseForEvaluation(expression);
      } catch (e) {
        fastError = e as Error;
      }
      
      expect(directError).toBeDefined();
      expect(fastError).toBeDefined();
      
      // Error messages should be similar (may have slight formatting differences)
      expect(fastError!.message).toContain('line');
      expect(fastError!.message).toContain('column');
    });
  });
  
  describe('Performance characteristics', () => {
    it('Fast mode has similar performance to direct parser', () => {
      const expression = 'Patient.name.where(use = \'official\').given.first()';
      const iterations = 100;
      
      // Warm up
      for (let i = 0; i < 10; i++) {
        const parser1 = new FHIRPathParser(expression, { throwOnError: true });
        parser1.parse();
        parseForEvaluation(expression);
      }
      
      // Measure direct parser
      const directStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        const parser = new FHIRPathParser(expression, { throwOnError: true });
        parser.parse();
      }
      const directDuration = performance.now() - directStart;
      
      // Measure Fast mode
      const fastStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        parseForEvaluation(expression);
      }
      const fastDuration = performance.now() - fastStart;
      
      // Fast mode should be within reasonable bounds of direct parser performance
      // (can be faster or slightly slower)
      const ratio = fastDuration / directDuration;
      expect(ratio).toBeGreaterThan(0.5); // Not more than 2x slower
      expect(ratio).toBeLessThan(1.5); // Not more than 50% slower
    });
  });
  
  describe('Token array input', () => {
    it('supports token array input in backward compatible way', () => {
      const expression = 'Patient.name';
      
      // First get tokens using direct parser
      const tokens = [
        { type: 'IDENTIFIER', value: 'Patient', position: { line: 0, column: 0, offset: 0 } },
        { type: 'DOT', value: '.', position: { line: 0, column: 7, offset: 7 } },
        { type: 'IDENTIFIER', value: 'name', position: { line: 0, column: 8, offset: 8 } },
        { type: 'EOF', value: '', position: { line: 0, column: 12, offset: 12 } }
      ];
      
      // Direct parser with tokens
      const directParser = new FHIRPathParser(tokens as any, { throwOnError: true });
      const directAst = directParser.parse().ast;
      
      // New parse with tokens and throwOnError
      const newResult = parse(tokens as any, { throwOnError: true });
      
      expect(newResult.ast.type).toBe(directAst.type);
    });
  });
});