import { describe, it, expect } from 'bun:test';
import { analyze } from '../src/index';

describe('Type Operation Validation', () => {
  describe('ofType function', () => {
    it('should require ModelProvider for ofType with primitive types', () => {
      const result = analyze('data.ofType(String)');
      const modelDiagnostics = result.diagnostics.filter(d => d.code === 'MODEL_REQUIRED_FOR_TYPE_OPERATION');
      expect(modelDiagnostics).toHaveLength(1);
      expect(modelDiagnostics[0]?.message).toContain('ofType');
      expect(modelDiagnostics[0]?.message).toContain('ModelProvider');
      expect(modelDiagnostics[0]?.message).toContain('choice types');
    });

    it('should require ModelProvider for ofType with complex types', () => {
      const result = analyze('data.ofType(Patient)');
      const modelDiagnostics = result.diagnostics.filter(d => d.code === 'MODEL_REQUIRED_FOR_TYPE_OPERATION');
      expect(modelDiagnostics).toHaveLength(1);
    });

    it('should not error when ModelProvider is provided', () => {
      const mockModelProvider = {
        getType: () => ({ type: 'String' as const, singleton: false }),
        getElementType: () => undefined,
        ofType: () => ({ type: 'String' as const, singleton: false }),
        getElementNames: () => [],
      };
      const result = analyze('data.ofType(String)', { modelProvider: mockModelProvider });
      expect(result.diagnostics.filter(d => d.code === 'MODEL_REQUIRED_FOR_TYPE_OPERATION')).toHaveLength(0);
    });
  });

  describe('is operator', () => {
    it('should require ModelProvider for is operator with primitive types', () => {
      const result = analyze('data is Boolean');
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.code).toBe('MODEL_REQUIRED_FOR_TYPE_OPERATION');
      expect(result.diagnostics[0]?.message).toContain('is');
      expect(result.diagnostics[0]?.message).toContain('ModelProvider');
    });

    it('should require ModelProvider for is operator with complex types', () => {
      const result = analyze('data is Patient');
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.code).toBe('MODEL_REQUIRED_FOR_TYPE_OPERATION');
    });
  });

  describe('as operator', () => {
    it('should require ModelProvider for as operator with primitive types', () => {
      const result = analyze('data as Integer');
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.code).toBe('MODEL_REQUIRED_FOR_TYPE_OPERATION');
      expect(result.diagnostics[0]?.message).toContain('as');
      expect(result.diagnostics[0]?.message).toContain('ModelProvider');
    });

    it('should require ModelProvider for as operator with complex types', () => {
      const result = analyze('data as Observation');
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.code).toBe('MODEL_REQUIRED_FOR_TYPE_OPERATION');
    });
  });

  describe('multiple type operations', () => {
    it('should report errors for each type operation without ModelProvider', () => {
      const result = analyze('data.ofType(String) | value is Boolean | item as Integer');
      expect(result.diagnostics.filter(d => d.code === 'MODEL_REQUIRED_FOR_TYPE_OPERATION')).toHaveLength(3);
    });
  });
});