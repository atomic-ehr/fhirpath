import { describe, it, expect } from 'bun:test';
import { DiagnosticCollector } from '../../legacy-src/parser/diagnostics';
import { ErrorCode } from '../../legacy-src/api/errors';
import type { TextRange } from '../../legacy-src/parser/types';

describe('DiagnosticCollector', () => {
  const mockRange: TextRange = {
    start: { line: 0, character: 0, offset: 0 },
    end: { line: 0, character: 5, offset: 5 }
  };
  
  it('collects multiple diagnostics', () => {
    const collector = new DiagnosticCollector();
    
    collector.addError(mockRange, 'Error 1', ErrorCode.SYNTAX_ERROR);
    collector.addError(mockRange, 'Error 2', ErrorCode.UNEXPECTED_TOKEN);
    
    const diagnostics = collector.getDiagnostics();
    expect(diagnostics).toHaveLength(2);
    expect(collector.hasErrors()).toBe(true);
    expect(collector.getErrorCount()).toBe(2);
  });
  
  it('preserves diagnostic order', () => {
    const collector = new DiagnosticCollector();
    
    collector.addError(mockRange, 'First error', ErrorCode.PARSE_ERROR);
    collector.addWarning(mockRange, 'First warning', ErrorCode.TYPE_ERROR);
    collector.addError(mockRange, 'Second error', ErrorCode.SYNTAX_ERROR);
    
    const diagnostics = collector.getDiagnostics();
    expect(diagnostics[0]!.message).toBe('First error');
    expect(diagnostics[1]!.message).toBe('First warning');
    expect(diagnostics[2]!.message).toBe('Second error');
  });
  
  it('tracks different severity levels', () => {
    const collector = new DiagnosticCollector();
    
    collector.addError(mockRange, 'Error', ErrorCode.PARSE_ERROR);
    collector.addWarning(mockRange, 'Warning', ErrorCode.TYPE_ERROR);
    collector.addInfo(mockRange, 'Info', ErrorCode.ANALYSIS_ERROR);
    collector.addHint(mockRange, 'Hint', ErrorCode.UNREACHABLE_CODE);
    
    const diagnostics = collector.getDiagnostics();
    expect(diagnostics).toHaveLength(4);
    
    expect(diagnostics[0]!.severity).toBe(1); // Error
    expect(diagnostics[1]!.severity).toBe(2); // Warning
    expect(diagnostics[2]!.severity).toBe(3); // Info
    expect(diagnostics[3]!.severity).toBe(4); // Hint
    
    expect(collector.hasErrors()).toBe(true);
    expect(collector.hasWarnings()).toBe(true);
    expect(collector.getErrorCount()).toBe(1);
    expect(collector.getWarningCount()).toBe(1);
  });
  
  it('respects maxErrors limit', () => {
    const collector = new DiagnosticCollector(2);
    
    collector.addError(mockRange, 'Error 1', ErrorCode.PARSE_ERROR);
    collector.addError(mockRange, 'Error 2', ErrorCode.SYNTAX_ERROR);
    collector.addError(mockRange, 'Error 3', ErrorCode.UNEXPECTED_TOKEN);
    collector.addError(mockRange, 'Error 4', ErrorCode.TYPE_ERROR);
    
    const diagnostics = collector.getDiagnostics();
    expect(diagnostics).toHaveLength(2);
    expect(collector.getErrorCount()).toBe(2);
  });
  
  it('does not limit warnings when maxErrors is reached', () => {
    const collector = new DiagnosticCollector(1);
    
    collector.addError(mockRange, 'Error 1', ErrorCode.PARSE_ERROR);
    collector.addError(mockRange, 'Error 2', ErrorCode.SYNTAX_ERROR); // Should be ignored
    collector.addWarning(mockRange, 'Warning 1', ErrorCode.TYPE_ERROR);
    collector.addWarning(mockRange, 'Warning 2', ErrorCode.ANALYSIS_ERROR);
    
    const diagnostics = collector.getDiagnostics();
    expect(diagnostics).toHaveLength(3); // 1 error + 2 warnings
    expect(collector.getErrorCount()).toBe(1);
    expect(collector.getWarningCount()).toBe(2);
  });
  
  it('clears all diagnostics', () => {
    const collector = new DiagnosticCollector();
    
    collector.addError(mockRange, 'Error', ErrorCode.PARSE_ERROR);
    collector.addWarning(mockRange, 'Warning', ErrorCode.TYPE_ERROR);
    
    expect(collector.hasErrors()).toBe(true);
    expect(collector.hasWarnings()).toBe(true);
    
    collector.clear();
    
    expect(collector.getDiagnostics()).toHaveLength(0);
    expect(collector.hasErrors()).toBe(false);
    expect(collector.hasWarnings()).toBe(false);
    expect(collector.getErrorCount()).toBe(0);
    expect(collector.getWarningCount()).toBe(0);
  });
  
  it('includes source field in diagnostics', () => {
    const collector = new DiagnosticCollector();
    
    collector.addError(mockRange, 'Test error', ErrorCode.PARSE_ERROR);
    
    const diagnostic = collector.getDiagnostics()[0];
    expect(diagnostic!.source).toBe('fhirpath-parser');
  });
  
  it('creates immutable diagnostic snapshots', () => {
    const collector = new DiagnosticCollector();
    
    collector.addError(mockRange, 'Error 1', ErrorCode.PARSE_ERROR);
    const diagnostics1 = collector.getDiagnostics();
    
    collector.addError(mockRange, 'Error 2', ErrorCode.SYNTAX_ERROR);
    const diagnostics2 = collector.getDiagnostics();
    
    expect(diagnostics1).toHaveLength(1);
    expect(diagnostics2).toHaveLength(2);
    expect(diagnostics1).not.toBe(diagnostics2); // Different arrays
  });
});