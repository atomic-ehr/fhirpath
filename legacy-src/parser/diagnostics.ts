import type { ParseDiagnostic, DiagnosticSeverity, TextRange } from './types';
import type { ErrorCode } from '../api/errors';

export class DiagnosticCollector {
  private diagnostics: ParseDiagnostic[] = [];
  private errorCount = 0;
  private warningCount = 0;
  private maxErrors: number;
  
  constructor(maxErrors: number = Number.MAX_SAFE_INTEGER) {
    this.maxErrors = maxErrors;
  }
  
  addError(range: TextRange, message: string, code: ErrorCode): void {
    if (this.errorCount >= this.maxErrors) {
      return;
    }
    
    this.diagnostics.push({
      range,
      severity: 1 as DiagnosticSeverity.Error,
      code,
      message,
      source: 'fhirpath-parser'
    });
    this.errorCount++;
  }
  
  addWarning(range: TextRange, message: string, code: ErrorCode): void {
    this.diagnostics.push({
      range,
      severity: 2 as DiagnosticSeverity.Warning,
      code,
      message,
      source: 'fhirpath-parser'
    });
    this.warningCount++;
  }
  
  addInfo(range: TextRange, message: string, code: ErrorCode): void {
    this.diagnostics.push({
      range,
      severity: 3 as DiagnosticSeverity.Information,
      code,
      message,
      source: 'fhirpath-parser'
    });
  }
  
  addHint(range: TextRange, message: string, code: ErrorCode): void {
    this.diagnostics.push({
      range,
      severity: 4 as DiagnosticSeverity.Hint,
      code,
      message,
      source: 'fhirpath-parser'
    });
  }
  
  getDiagnostics(): ParseDiagnostic[] {
    return [...this.diagnostics];
  }
  
  hasErrors(): boolean {
    return this.errorCount > 0;
  }
  
  hasWarnings(): boolean {
    return this.warningCount > 0;
  }
  
  getErrorCount(): number {
    return this.errorCount;
  }
  
  getWarningCount(): number {
    return this.warningCount;
  }
  
  clear(): void {
    this.diagnostics = [];
    this.errorCount = 0;
    this.warningCount = 0;
  }
}