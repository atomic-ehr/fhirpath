import { describe, it, expect } from 'bun:test';
import { parse, isDiagnosticResult } from '../../legacy-src/api';
import { ErrorCode } from '../../legacy-src/api/errors';

describe.skip('Contextual Error Messages', () => {
  it('provides context-specific messages for function calls', () => {
    const result = parse('Patient.where(])', { 
      errorRecovery: true, trackRanges: true 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    const diagnostic = result.diagnostics[0];
    expect(diagnostic).toBeDefined();
    expect(diagnostic!.message).toContain('in function call');
    expect(diagnostic!.message).toContain("Expected");
  });
  
  it('describes tokens in human-readable form', () => {
    const result = parse('Patient.name[', { 
      errorRecovery: true, trackRanges: true 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    const diagnostic = result.diagnostics.find(d => d.message.includes('index'));
    expect(diagnostic).toBeDefined();
  });
  
  it('provides clear message for double dot operator', () => {
    const result = parse('Patient..name', { 
      errorRecovery: true, trackRanges: true 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    const diagnostic = result.diagnostics.find(d => d.code === ErrorCode.INVALID_OPERATOR);
    expect(diagnostic).toBeDefined();
    expect(diagnostic!.message).toBe("Invalid '..' operator - use single '.' for navigation");
  });
  
  it('provides context for type cast errors', () => {
    const result = parse('Patient.name as', { 
      errorRecovery: true, trackRanges: true 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    const diagnostic = result.diagnostics.find(d => d.code === ErrorCode.EXPECTED_IDENTIFIER);
    expect(diagnostic).toBeDefined();
    expect(diagnostic!.message).toContain("Expected type name after 'as'");
  });
  
  it('provides context for membership test errors', () => {
    const result = parse('Patient.name is', { 
      errorRecovery: true, trackRanges: true 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    const diagnostic = result.diagnostics.find(d => d.code === ErrorCode.EXPECTED_IDENTIFIER);
    expect(diagnostic).toBeDefined();
    expect(diagnostic!.message).toContain("Expected type name after 'is'");
  });
  
  it('reports multiple errors with appropriate context', () => {
    const result = parse('Patient.where().name[.exists(', { 
      errorRecovery: true, trackRanges: true 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    // Should have multiple contextual errors
    expect(result.diagnostics.length).toBeGreaterThan(1);
    
    // Check for missing arguments error
    const argError = result.diagnostics.find(d => d.code === ErrorCode.MISSING_ARGUMENTS);
    expect(argError).toBeDefined();
    
    // Check for other errors
    const hasContextualMessages = result.diagnostics.some(d => 
      d.message.includes('in function call') || 
      d.message.includes('in index expression')
    );
    expect(hasContextualMessages).toBe(true);
  });
  
  it('provides helpful error for empty brackets', () => {
    const result = parse('Patient.name[]', { 
      errorRecovery: true, trackRanges: true 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    const diagnostic = result.diagnostics.find(d => d.code === ErrorCode.EXPECTED_EXPRESSION);
    expect(diagnostic).toBeDefined();
    expect(diagnostic!.message).toContain("Expected expression in index");
  });
  
  it('handles unexpected end of expression', () => {
    const result = parse('Patient.name +', { 
      errorRecovery: true, trackRanges: true 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    const diagnostic = result.diagnostics.find(d => d.code === ErrorCode.EXPECTED_EXPRESSION);
    expect(diagnostic).toBeDefined();
    expect(diagnostic!.message).toContain("Expected expression after '+'");
  });
});