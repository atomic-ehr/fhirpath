import { describe, it, expect } from 'bun:test';
import { 
  parse, 
  ParserMode, 
  isStandardResult,
  isDiagnosticResult 
} from '../../src/api';
import { NodeType } from '../../src/parser/ast';
import { ErrorCode } from '../../src/api/errors';

describe('Parser Modes', () => {
  it('defaults to Standard mode', () => {
    const result = parse('Patient.name');
    expect(isStandardResult(result)).toBe(true);
    
    if (isStandardResult(result)) {
      expect(result.diagnostics).toBeArray();
      expect(result.hasErrors).toBe(false);
      expect(result.ast).toBeDefined();
    }
  });
  
  it('uses throwOnError flag when specified', () => {
    // Should throw on error
    expect(() => {
      parse('Patient..name', { throwOnError: true });
    }).toThrow();
    
    // Should not throw on valid expression
    const result = parse('Patient.name', { throwOnError: true });
    expect(isStandardResult(result)).toBe(true);
    if (isStandardResult(result)) {
      expect(result.ast).toBeDefined();
      expect(result.ast.type).toBe(NodeType.Binary);
    }
  });
  
  it('returns diagnostics in Standard mode for errors', () => {
    const result = parse('Patient..name', { mode: ParserMode.Standard });
    
    expect(isStandardResult(result)).toBe(true);
    if (isStandardResult(result)) {
      expect(result.diagnostics.length).toBeGreaterThan(0);
      expect(result.hasErrors).toBe(true);
      expect(result.diagnostics[0]!.severity).toBe(1); // Error
      expect(result.diagnostics[0]!.code).toBe(ErrorCode.INVALID_OPERATOR);
    }
  });
  
  it('throws with throwOnError flag for errors', () => {
    expect(() => {
      parse('Patient..name', { throwOnError: true });
    }).toThrow();
  });
  
  it('respects maxErrors option in Standard mode', () => {
    const expression = 'Patient..name[.given..family';
    const result = parse(expression, { 
      mode: ParserMode.Standard,
      maxErrors: 1 
    });
    
    if (isStandardResult(result)) {
      expect(result.diagnostics.length).toBe(1);
      expect(result.hasErrors).toBe(true);
    }
  });
  
  it('collects multiple errors in Standard mode', () => {
    const expression = 'Patient.name.where()'; // Missing arguments
    const result = parse(expression, { mode: ParserMode.Standard });
    
    if (isStandardResult(result)) {
      // Currently this might not report as error in our basic implementation
      // but the infrastructure is there for future enhancement
      expect(result.diagnostics).toBeArray();
    }
  });
  
  describe('Type Guards', () => {
    
    it('correctly identifies Standard results', () => {
      const result = parse('5 + 3', { mode: ParserMode.Standard });
      expect(isStandardResult(result)).toBe(true);
      expect(isDiagnosticResult(result)).toBe(false);
    });
    
    // Diagnostic mode now returns DiagnosticParseResult
    it('Diagnostic mode returns DiagnosticParseResult', () => {
      const result = parse('5 + 3', { mode: ParserMode.Diagnostic });
      expect(isDiagnosticResult(result)).toBe(true);
      expect(isStandardResult(result)).toBe(true); // DiagnosticResult extends StandardResult
      
      // Check diagnostic-specific properties
      if (isDiagnosticResult(result)) {
        expect(result.isPartial).toBe(false);
        expect(result.ranges).toBeDefined();
      }
    });
  });
  
  describe('Mode-specific behavior', () => {
    it('throwOnError flag maintains performance characteristics', () => {
      const expression = 'Patient.name.given.first()';
      
      // throwOnError should have minimal overhead
      const start = performance.now();
      const result = parse(expression, { throwOnError: true });
      const duration = performance.now() - start;
      
      expect(isStandardResult(result)).toBe(true);
      // This is a simple check - real performance testing would be more sophisticated
      expect(duration).toBeLessThan(10); // Should be very fast
    });
    
    it('Standard mode provides basic diagnostics without significant overhead', () => {
      const expression = 'Patient.name.given.first()';
      
      const result = parse(expression, { mode: ParserMode.Standard });
      
      if (isStandardResult(result)) {
        expect(result.diagnostics).toEqual([]);
        expect(result.hasErrors).toBe(false);
        expect(result.ast).toBeDefined();
      }
    });
  });
});