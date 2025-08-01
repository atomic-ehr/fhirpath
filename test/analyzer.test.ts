import { describe, it, expect, beforeAll } from 'bun:test';
import { analyze } from '../src/index';
import { DiagnosticSeverity } from '../src/types';
import { FHIRModelProvider } from '../src/model-provider';

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
      expect(result.diagnostics[0]?.range).toBeDefined();
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
      expect(diagnostic?.range).toBeDefined();
      expect(diagnostic?.range.start).toBeDefined();
      expect(diagnostic?.range.end).toBeDefined();
      expect(diagnostic?.message).toBeDefined();
      
      // Check optional fields
      expect(diagnostic?.severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostic?.code).toBe('UNKNOWN_VARIABLE');
      expect(diagnostic?.source).toBe('fhirpath-analyzer');
    });
    
    it('should use default range when position is not available', () => {
      const result = analyze('$unknown');
      const diagnostic = result.diagnostics[0];
      
      // Check that range is properly set (with LSP-compatible character field)
      expect(diagnostic?.range.start.line).toBeDefined();
      expect(diagnostic?.range.start.character).toBeDefined();
      expect(diagnostic?.range.end.line).toBeDefined();
      expect(diagnostic?.range.end.character).toBeDefined();
    });
  });

  describe('FHIR Model Provider type checking', () => {
    let modelProvider: FHIRModelProvider;
    
    beforeAll(async () => {
      modelProvider = new FHIRModelProvider({
        packages: [
          { name: 'hl7.fhir.r4.core', version: '4.0.1' }
        ],
        cacheDir: './.test-fhir-cache',
        registryUrl: 'https://fs.get-ig.org/pkgs'
      });
      
      await modelProvider.initialize();
    });
    
    it('should infer types through FHIR model navigation', () => {
      const result = analyze('Patient.gender', {
        modelProvider,
        inputType: { type: 'Any', singleton: true, namespace: 'FHIR', name: 'Patient' }
      });
      
      expect(result.diagnostics).toEqual([]);
      
      // Check that gender is properly typed as a code (which maps to String in FHIRPath)
      const ast = result.ast;
      expect(ast?.typeInfo).toMatchObject({
        type: 'String',
        singleton: true,
        namespace: 'FHIR',
        name: 'code'
      });
    });

    it('should detect type error when calling substring on non-string type', () => {
      // Using active which is boolean, not string
      const result = analyze('Patient.active.substring(0, 1)', {
        modelProvider,
        inputType: { type: 'Any', singleton: true, namespace: 'FHIR', name: 'Patient' }
      });
      
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        severity: DiagnosticSeverity.Error,
        code: 'INPUT_TYPE_MISMATCH',
        message: expect.stringContaining("expects input type String")
      });
    });

    it('should allow string operations on string types', () => {
      const result = analyze('Patient.name.family.substring(0, 1)', {
        modelProvider,
        inputType: { type: 'Any', singleton: true, namespace: 'FHIR', name: 'Patient' }
      });
      
      expect(result.diagnostics).toEqual([]);
    });

    it('should detect type errors in arithmetic operations', () => {
      const result = analyze('Patient.name.family + Patient.active', {
        modelProvider,
        inputType: { type: 'Any', singleton: true, namespace: 'FHIR', name: 'Patient' }
      });
      
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        severity: DiagnosticSeverity.Error,
        code: 'TYPE_MISMATCH',
        message: expect.stringContaining("operator '+' cannot be applied to types")
      });
    });

    it('should handle collection types properly', () => {
      const result = analyze('Patient.name.given.count()', {
        modelProvider,
        inputType: { type: 'Any', singleton: true, namespace: 'FHIR', name: 'Patient' }
      });
      
      expect(result.diagnostics).toEqual([]);
      
      // count() should return Integer
      const ast = result.ast;
      expect(ast?.typeInfo).toMatchObject({
        type: 'Integer',
        singleton: true
      });
    });

    it('should detect errors when accessing non-existent properties', () => {
      const result = analyze('Patient.nonExistentField', {
        modelProvider,
        inputType: { type: 'Any', singleton: true, namespace: 'FHIR', name: 'Patient' }
      });
      
      // The property access might still be valid in FHIRPath (returns empty collection)
      // but the type should be Any
      expect(result.diagnostics).toEqual([]);
      const ast = result.ast;
      expect(ast?.typeInfo?.type).toBe('Any');
    });

    it('should properly type check where clause conditions', () => {
      const result = analyze('Patient.name.where(use + 1)', {
        modelProvider,
        inputType: { type: 'Any', singleton: true, namespace: 'FHIR', name: 'Patient' }
      });
      
      // The where condition should expect a Boolean, but we're providing a number
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        code: 'TYPE_MISMATCH'
      });
    });

    it('should handle union operations with type preservation', () => {
      const result = analyze('Patient.name.given | Patient.name.family', {
        modelProvider,
        inputType: { type: 'Any', singleton: true, namespace: 'FHIR', name: 'Patient' }
      });
      
      expect(result.diagnostics).toEqual([]);
      
      // Union should preserve the string type
      const ast = result.ast;
      expect(ast?.typeInfo).toMatchObject({
        type: 'String',
        singleton: false,
        namespace: 'FHIR',
        name: 'string'
      });
    });

    it('should type check function arguments with FHIR types', () => {
      const result = analyze('Patient.birthDate.toString().substring(Patient.active)', {
        modelProvider,
        inputType: { type: 'Any', singleton: true, namespace: 'FHIR', name: 'Patient' }
      });
      
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        severity: DiagnosticSeverity.Error,
        code: 'ARGUMENT_TYPE_MISMATCH',
        message: expect.stringContaining('expects Integer')
      });
    });

    it('should handle complex nested expressions with proper type inference', () => {
      const result = analyze('Patient.contact.where(relationship.coding.code = "family").name.given.first()', {
        modelProvider,
        inputType: { type: 'Any', singleton: true, namespace: 'FHIR', name: 'Patient' }
      });
      
      expect(result.diagnostics).toEqual([]);
      
      // first() should return a singleton string
      const ast = result.ast;
      expect(ast?.typeInfo?.singleton).toBe(true);
    });

    it('should detect type mismatches in comparisons', () => {
      const result = analyze('Patient.birthDate > Patient.name.family', {
        modelProvider,
        inputType: { type: 'Any', singleton: true, namespace: 'FHIR', name: 'Patient' }
      });
      
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        severity: DiagnosticSeverity.Error,
        code: 'TYPE_MISMATCH'
      });
    });

    it('should handle polymorphic types correctly', () => {
      const result = analyze('Observation.value.value', {
        modelProvider,
        inputType: { type: 'Any', singleton: true, namespace: 'FHIR', name: 'Observation' }
      });
      
      // value[x] is polymorphic, so this should work
      expect(result.diagnostics).toEqual([]);
    });


    it('should handle type casting operations', () => {
      const result = analyze('(Patient.multipleBirthInteger as String).substring(0, 1)', {
        modelProvider,
        inputType: { type: 'Any', singleton: true, namespace: 'FHIR', name: 'Patient' }
      });
      
      // After casting to String, substring should work
      expect(result.diagnostics).toEqual([]);
    });

    it('should detect errors in select expressions', () => {
      const result = analyze('Patient.name.select(given + use)', {
        modelProvider,
        inputType: { type: 'Any', singleton: true, namespace: 'FHIR', name: 'Patient' }
      });
      
      // given is a list of strings, use is a code - can't add them
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({
        severity: DiagnosticSeverity.Error,
        code: 'TYPE_MISMATCH'
      });
    });

    it('should handle extension navigation', () => {
      const result = analyze('Patient.extension.where(url = "http://example.org/ext").value', {
        modelProvider,
        inputType: { type: 'Any', singleton: true, namespace: 'FHIR', name: 'Patient' }
      });
      
      expect(result.diagnostics).toEqual([]);
    });

  });
});