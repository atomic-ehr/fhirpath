import { describe, it, expect } from 'bun:test';
import { parse, ParserMode, isDiagnosticResult, isStandardResult } from '../../src/api';
import { SourceMapper } from '../../src/parser/source-mapper';
import { NodeType } from '../../src/parser/ast';

describe('Range Tracking', () => {
  it('tracks ranges for diagnostics in standard mode', () => {
    const expression = 'Patient..name';
    const result = parse(expression, { 
      mode: ParserMode.Standard 
    });
    
    if (!isStandardResult(result)) {
      throw new Error('Expected standard result');
    }
    
    expect(result.diagnostics).toHaveLength(1);
    const diag = result.diagnostics[0]!;
    
    // Check range spans the double dot
    expect(diag.range.start.character).toBe(7); // Start of first dot
    expect(diag.range.end.character).toBe(9);   // End of second dot
  });
  
  it('tracks ranges for multiple errors', () => {
    const expression = 'Patient.where(active = true';
    const result = parse(expression, { 
      mode: ParserMode.Diagnostic 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    const unclosedParen = result.diagnostics.find(d => d.code === 'UNCLOSED_PARENTHESIS');
    expect(unclosedParen).toBeDefined();
    
    // Should point to the opening parenthesis
    expect(unclosedParen!.range.start.character).toBe(13); // Position of '('
  });
  
  it('calculates accurate ranges for different node types', () => {
    const expression = 'Patient.name.given.first()';
    const mapper = new SourceMapper(expression);
    
    // Test tokenToRange
    const token = { 
      type: 1, 
      value: 'Patient', 
      position: { line: 0, column: 0, offset: 0 } 
    };
    const range = mapper.tokenToRange(token as any);
    
    expect(range.start.offset).toBe(0);
    expect(range.end.offset).toBe(7); // Length of 'Patient'
    expect(range.start.line).toBe(0);
    expect(range.start.character).toBe(0);
  });
  
  it('handles multi-line expressions correctly', () => {
    const expression = 'Patient\n  .name\n  .given';
    const result = parse(expression, { 
      mode: ParserMode.Standard 
    });
    
    if (!isStandardResult(result)) {
      throw new Error('Expected standard result');
    }
    
    // AST should be valid
    expect(result.ast).toBeDefined();
    expect(result.hasErrors).toBe(false);
  });
  
  it('tracks range for error at end of expression', () => {
    const expression = 'Patient.name.';
    const result = parse(expression, { 
      mode: ParserMode.Diagnostic 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    const diagnostic = result.diagnostics[0];
    expect(diagnostic).toBeDefined();
    
    // Error should be at the final dot
    expect(diagnostic!.range.start.character).toBe(12);
  });
  
  it('tracks ranges for nested expressions', () => {
    const expression = 'Patient.name[0].given';
    const mapper = new SourceMapper(expression);
    
    // Test offsetToPosition
    const pos = mapper.offsetToPosition(14); // Position after [0]
    expect(pos.character).toBe(14);
    expect(pos.line).toBe(0);
  });
  
  it('handles CRLF line endings correctly', () => {
    const expression = 'Patient\r\n  .name\r\n  .given';
    const mapper = new SourceMapper(expression);
    
    // Position after first line should be on line 1
    const pos = mapper.offsetToPosition(9); // After \r\n
    expect(pos.line).toBe(1);
    expect(pos.character).toBe(0);
  });
  
  it('provides accurate ranges for collection literals', () => {
    const expression = '{1, 2, 3}';
    const result = parse(expression, { 
      mode: ParserMode.Standard 
    });
    
    if (!isStandardResult(result)) {
      throw new Error('Expected standard result');
    }
    
    expect(result.ast).toBeDefined();
    expect(result.ast.type).toBe(NodeType.Collection);
  });
  
  it('tracks ranges for complex error scenarios', () => {
    const expression = 'Patient.where(name.given contains "John" and age > )';
    const result = parse(expression, { 
      mode: ParserMode.Diagnostic 
    });
    
    if (!isDiagnosticResult(result)) {
      throw new Error('Expected diagnostic result');
    }
    
    // Should have error about missing expression after >
    const missingExpr = result.diagnostics.find(d => d.code === 'EXPECTED_EXPRESSION');
    expect(missingExpr).toBeDefined();
    
    // Range should point to position after >
    expect(missingExpr!.range.start.character).toBeGreaterThan(48);
  });
});