import { describe, it, expect } from 'bun:test';
import { analyze } from '../src/index';
import { DiagnosticSeverity } from '../src/types';

describe('Analyzer', () => {
  describe('basic expressions', () => {
    it('should not report errors for valid literals', () => {
      const result = analyze('5');
      expect(result.diagnostics).toEqual([]);
    });

    it('should not report errors for valid operators', () => {
      const result = analyze('5 + 3');
      expect(result.diagnostics).toEqual([]);
    });

    // Skip - parser rejects invalid operators before analyzer
  });

  describe('variables', () => {
    it('should not report errors for built-in variables', () => {
      const result = analyze('$this');
      expect(result.diagnostics).toEqual([]);
    });

    it('should report unknown variable', () => {
      const result = analyze('$unknown');
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        severity: DiagnosticSeverity.Error,
        code: 'UNKNOWN_VARIABLE',
        message: 'Unknown variable: $unknown',
        source: 'fhirpath-analyzer'
      });
      expect(result.diagnostics[0].range).toBeDefined();
    });

    it('should not report errors for user-defined variables', () => {
      const result = analyze('%myVar + 5', { variables: { myVar: 10 } });
      expect(result.diagnostics).toEqual([]);
    });

    it('should report unknown user variable', () => {
      const result = analyze('%unknown + 5');
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        severity: DiagnosticSeverity.Error,
        code: 'UNKNOWN_USER_VARIABLE',
        message: 'Unknown user variable: %unknown',
        source: 'fhirpath-analyzer'
      });
    });
  });

  describe('functions', () => {
    it('should not report errors for valid functions', () => {
      const result = analyze('name.where(use = "official")');
      expect(result.diagnostics).toEqual([]);
    });

    it('should report unknown function', () => {
      const result = analyze('name.unknownFunc()');
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        severity: DiagnosticSeverity.Error,
        code: 'UNKNOWN_FUNCTION',
        message: 'Unknown function: unknownFunc',
        source: 'fhirpath-analyzer'
      });
    });

    it('should report too few arguments', () => {
      const result = analyze('substring()'); // substring requires at least 1 argument
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        severity: DiagnosticSeverity.Error,
        code: 'TOO_FEW_ARGS'
      });
    });

    it('should report too many arguments', () => {
      const result = analyze('count(1, 2, 3)'); // count accepts at most 0 arguments
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        severity: DiagnosticSeverity.Error,
        code: 'TOO_MANY_ARGS'
      });
    });
  });

  describe('complex expressions', () => {
    it('should analyze nested expressions', () => {
      const result = analyze('name.where(use = "official").given');
      expect(result.diagnostics).toEqual([]);
    });

    it('should report multiple errors', () => {
      const result = analyze('$unknown + unknownFunc()');
      expect(result.diagnostics).toHaveLength(2);
      expect(result.diagnostics.map(d => d.code)).toEqual([
        'UNKNOWN_VARIABLE',
        'UNKNOWN_FUNCTION'
      ]);
    });
  });

  describe('LSP compatibility', () => {
    it('should produce LSP-compatible diagnostics', () => {
      const result = analyze('$unknown');
      expect(result.diagnostics).toHaveLength(1);
      
      const diagnostic = result.diagnostics[0];
      
      // Check LSP-required fields
      expect(diagnostic.range).toBeDefined();
      expect(diagnostic.range.start).toBeDefined();
      expect(diagnostic.range.end).toBeDefined();
      expect(diagnostic.message).toBeDefined();
      
      // Check optional fields
      expect(diagnostic.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostic.code).toBe('UNKNOWN_VARIABLE');
      expect(diagnostic.source).toBe('fhirpath-analyzer');
    });
    
    it('should use default range when position is not available', () => {
      const result = analyze('$unknown');
      const diagnostic = result.diagnostics[0];
      
      // Check that range is properly set (with LSP-compatible character field)
      expect(diagnostic.range.start.line).toBeDefined();
      expect(diagnostic.range.start.character).toBeDefined();
      expect(diagnostic.range.end.line).toBeDefined();
      expect(diagnostic.range.end.character).toBeDefined();
    });
  });
});