import { describe, it, expect } from 'bun:test';
import { Parser } from '../src/parser';
import { Analyzer } from '../src/analyzer';
import { getInitializedModelProvider } from './model-provider-singleton';

describe('Analyzer navigation with FHIR types', () => {
  it('should navigate from Patient to name to given without errors', async () => {
    const modelProvider = await getInitializedModelProvider();
    
    // Parse the expression
    const parser = new Parser('Patient.name.given');
    const parseResult = parser.parse();
    expect(parseResult.errors).toHaveLength(0);
    
    // Analyze with model provider
    const analyzer = new Analyzer(modelProvider);
    const analysisResult = await analyzer.analyze(parseResult.ast);
    
    // Should have no diagnostics (no errors)
    expect(analysisResult.diagnostics).toHaveLength(0);
    
    // Should infer correct type
    expect(analysisResult.ast.typeInfo).toBeDefined();
    expect(analysisResult.ast.typeInfo?.type).toBe('String');
    expect(analysisResult.ast.typeInfo?.singleton).toBe(false); // given is an array
  });
  
  it('should navigate through complex FHIR paths', async () => {
    const modelProvider = await getInitializedModelProvider();
    
    const testCases = [
      { expression: 'Patient.name', expectedType: 'HumanName' as any, singleton: false },
      { expression: 'Patient.name.family', expectedType: 'String', singleton: true },
      { expression: 'Patient.name.given', expectedType: 'String', singleton: false },
      { expression: 'Patient.birthDate', expectedType: 'Date', singleton: true },
      { expression: 'Patient.identifier', expectedType: 'Identifier' as any, singleton: false },
      { expression: 'Observation.value', expectedType: 'Any', singleton: true }, // Union type
    ];
    
    for (const testCase of testCases) {
      const parser = new Parser(testCase.expression);
      const parseResult = parser.parse();
      expect(parseResult.errors).toHaveLength(0);
      
      const analyzer = new Analyzer(modelProvider);
      const analysisResult = await analyzer.analyze(parseResult.ast);
      
      // Should have no errors
      const errors = analysisResult.diagnostics.filter(d => d.severity === 1);
      expect(errors).toHaveLength(0);
      
      // Check type inference
      const typeInfo = analysisResult.ast.typeInfo;
      expect(typeInfo).toBeDefined();
      expect(typeInfo?.type).toBe(testCase.expectedType);
      expect(typeInfo?.singleton).toBe(testCase.singleton);
    }
  });
  
  it('should report error for invalid property navigation', async () => {
    const modelProvider = await getInitializedModelProvider();
    
    // Parse an expression with invalid property
    const parser = new Parser('Patient.name.invalidProperty');
    const parseResult = parser.parse();
    expect(parseResult.errors).toHaveLength(0);
    
    // Analyze with model provider
    const analyzer = new Analyzer(modelProvider);
    const analysisResult = await analyzer.analyze(parseResult.ast);
    
    // Should have diagnostic for unknown property
    expect(analysisResult.diagnostics.length).toBeGreaterThan(0);
    const error = analysisResult.diagnostics[0];
    expect(error?.code).toBe('FP1005');
    expect(error?.message).toContain('Unknown property');
    expect(error?.message).toContain('invalidProperty');
  });
  
  it('should handle string operations on navigated properties', async () => {
    const modelProvider = await getInitializedModelProvider();
    
    // Parse expression with string operation
    const parser = new Parser("Patient.name.given.first().startsWith('J')");
    const parseResult = parser.parse();
    expect(parseResult.errors).toHaveLength(0);
    
    // Analyze with model provider
    const analyzer = new Analyzer(modelProvider);
    const analysisResult = await analyzer.analyze(parseResult.ast);
    
    // Should have no errors
    const errors = analysisResult.diagnostics.filter(d => d.severity === 1);
    expect(errors).toHaveLength(0);
    
    // Result should be Boolean
    expect(analysisResult.ast.typeInfo?.type).toBe('Boolean');
    expect(analysisResult.ast.typeInfo?.singleton).toBe(true);
  });
});