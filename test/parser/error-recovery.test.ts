import { describe, it, expect } from 'bun:test';
import { parse, ParserMode, isStandardResult, isDiagnosticResult } from '../../src/api';
import { NodeType } from '../../src/parser/ast';
import { ErrorCode } from '../../src/api/errors';

describe('Error Recovery', () => {
  it('recovers from missing closing parenthesis', () => {
    const result = parse('Patient.where(active = true', { 
      mode: ParserMode.Diagnostic 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]!.code).toBe(ErrorCode.UNCLOSED_PARENTHESIS);
    expect(result.isPartial).toBe(true);
    expect(result.ast).toBeDefined(); // Partial AST created
  });
  
  it('recovers from multiple errors', () => {
    const result = parse('Patient..name[.given', { 
      mode: ParserMode.Diagnostic 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    expect(result.diagnostics.length).toBeGreaterThan(1);
    expect(result.isPartial).toBe(true);
    
    // Check for double dot diagnostic
    const doubleDotDiag = result.diagnostics.find(d => d.code === ErrorCode.INVALID_OPERATOR);
    expect(doubleDotDiag).toBeDefined();
    expect(doubleDotDiag!.message).toContain("Invalid '..' operator");
  });
  
  it('finds correct synchronization points', () => {
    const result = parse('Patient.name(, other', { 
      mode: ParserMode.Diagnostic 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    // Should recover at comma and continue parsing
    expect(result.ast).toBeDefined();
    expect(result.isPartial).toBe(true);
  });
  
  it('creates error nodes for invalid syntax', () => {
    const result = parse('Patient.[0]', { 
      mode: ParserMode.Diagnostic 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    // Should have diagnostic about expected identifier
    const identDiag = result.diagnostics.find(d => d.code === ErrorCode.EXPECTED_IDENTIFIER);
    expect(identDiag).toBeDefined();
  });
  
  it('handles unclosed brackets', () => {
    const result = parse('Patient.name[0', { 
      mode: ParserMode.Diagnostic 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    const bracketDiag = result.diagnostics.find(d => d.code === ErrorCode.UNCLOSED_BRACKET);
    expect(bracketDiag).toBeDefined();
    expect(bracketDiag!.message).toContain("Expected ']'");
  });
  
  it('handles unclosed braces in collections', () => {
    const result = parse('{1, 2, 3', { 
      mode: ParserMode.Diagnostic 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    const braceDiag = result.diagnostics.find(d => d.code === ErrorCode.UNCLOSED_BRACE);
    expect(braceDiag).toBeDefined();
    expect(braceDiag!.message).toContain("Expected '}'");
  });
  
  it('reports missing function arguments', () => {
    const result = parse('Patient.name.where()', { 
      mode: ParserMode.Diagnostic 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    const argsDiag = result.diagnostics.find(d => d.code === ErrorCode.MISSING_ARGUMENTS);
    expect(argsDiag).toBeDefined();
    expect(argsDiag!.message).toContain("Function 'where' requires arguments");
  });
  
  it('handles incomplete expressions at end', () => {
    const result = parse('Patient.name.', { 
      mode: ParserMode.Diagnostic 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    expect(result.isPartial).toBe(true);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
  
  it('standard mode reports basic diagnostics without recovery', () => {
    const result = parse('Patient..name', { 
      mode: ParserMode.Standard 
    });
    
    if (!isStandardResult(result)) {
      throw new Error('Expected standard result');
    }
    
    expect(result.hasErrors).toBe(true);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.ast).toBeDefined(); // Should still produce some AST
  });
  
  it('throwOnError flag throws on first error', () => {
    expect(() => {
      parse('Patient..name', { throwOnError: true });
    }).toThrow();
  });
  
  it('diagnostic mode continues after function call errors', () => {
    const result = parse('Patient.where(active = , name = "test")', { 
      mode: ParserMode.Diagnostic 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    // Should report error but continue to parse second argument
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.ast).toBeDefined();
    expect(result.isPartial).toBe(true);
  });
  
  it('recovers from trailing comma in collection', () => {
    const result = parse('{1, 2, 3,}', { 
      mode: ParserMode.Diagnostic 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    const trailingCommaDiag = result.diagnostics.find(d => d.code === ErrorCode.EXPECTED_EXPRESSION);
    expect(trailingCommaDiag).toBeDefined();
    expect(trailingCommaDiag!.message).toContain("Expected expression after ','");
  });
});