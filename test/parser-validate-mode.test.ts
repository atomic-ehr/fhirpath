import { describe, it, expect } from 'bun:test';
import { FHIRPathParser } from '../src/parser/parser';
import { ParserMode } from '../src/parser/types';
import type { ValidationResult } from '../src/parser/types';

// TODO: Validate mode is not yet implemented - it currently falls back to Standard mode
// These tests are temporarily disabled until validate mode is properly implemented
describe.skip('Parser Validate Mode', () => {
  function validate(expression: string): ValidationResult {
    const parser = new FHIRPathParser(expression, { mode: ParserMode.Validate });
    return parser.parse() as ValidationResult;
  }

  describe('Valid expressions', () => {
    it('validates simple literals', () => {
      const result = validate('42');
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it('validates simple navigation', () => {
      const result = validate('Patient.name.given');
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it('validates function calls', () => {
      const result = validate('name.where(use = "official").given');
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it('validates binary operations', () => {
      const result = validate('5 + 3 * 2');
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it('validates collections', () => {
      const result = validate('{1, 2, 3}');
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it('validates complex expressions', () => {
      const result = validate('Patient.name.where(use = "official" and given.exists()).family.first()');
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it('validates type operators', () => {
      const result = validate('observation is Observation');
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it('validates indexing', () => {
      const result = validate('items[0].value');
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });
  });

  describe('Invalid expressions', () => {
    it('detects missing closing parenthesis', () => {
      const result = validate('name.where(use = "official"');
      expect(result.valid).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain("Expected ')'");
    });

    it('detects unexpected tokens', () => {
      const result = validate('5 + + 3');
      expect(result.valid).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain('Expected expression');
    });

    it('detects invalid operator usage', () => {
      const result = validate('5 == 3');
      expect(result.valid).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain("'==' is not valid in FHIRPath");
    });

    it('detects missing type name', () => {
      const result = validate('value is');
      expect(result.valid).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain('Expected type name');
    });

    it('detects unclosed brackets', () => {
      const result = validate('items[0');
      expect(result.valid).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain("Expected ']'");
    });

    it('detects trailing commas', () => {
      const result = validate('{1, 2, 3,}');
      expect(result.valid).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].message).toContain('Trailing comma');
    });
  });

  describe('Performance', () => {
    it('should be faster than Standard mode for valid expressions', () => {
      const expression = 'Patient.name.where(use = "official").given.first()';
      
      // Warm up
      new FHIRPathParser(expression, { mode: ParserMode.Validate }).parse();
      new FHIRPathParser(expression, { mode: ParserMode.Standard }).parse();
      
      // Measure Validate mode
      const validateStart = performance.now();
      for (let i = 0; i < 1000; i++) {
        new FHIRPathParser(expression, { mode: ParserMode.Validate }).parse();
      }
      const validateTime = performance.now() - validateStart;
      
      // Measure Standard mode
      const standardStart = performance.now();
      for (let i = 0; i < 1000; i++) {
        new FHIRPathParser(expression, { mode: ParserMode.Standard }).parse();
      }
      const standardTime = performance.now() - standardStart;
      
      // Validate mode should be faster (no AST construction)
      expect(validateTime).toBeLessThan(standardTime);
      console.log(`Validate mode: ${validateTime.toFixed(2)}ms, Standard mode: ${standardTime.toFixed(2)}ms`);
    });
  });

  describe('Lexer errors', () => {
    it('handles unterminated strings', () => {
      const result = validate('"unterminated');
      expect(result.valid).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].code).toBe('UNTERMINATED_STRING');
    });

    it('handles invalid escape sequences', () => {
      const result = validate('"invalid\\x escape"');
      expect(result.valid).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.diagnostics[0].code).toBe('INVALID_ESCAPE');
    });
  });
});