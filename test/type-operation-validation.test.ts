import { describe, it, expect } from 'bun:test';
import { analyze } from '../src/index';
import { ErrorCodes } from "../src/index";

describe('Type Operation Validation', () => {
  describe('ofType function', () => {
    it('should not require ModelProvider for ofType with primitive types', async () => {
      const result = await analyze('data.ofType(String)');
      const modelDiagnostics = result.diagnostics.filter(d => d.code === ErrorCodes.MODEL_PROVIDER_REQUIRED);
      expect(modelDiagnostics).toHaveLength(0);
    });

    it('should require ModelProvider for ofType with complex types', async () => {
      const result = await analyze('data.ofType(Patient)');
      const modelDiagnostics = result.diagnostics.filter(d => d.code === ErrorCodes.MODEL_PROVIDER_REQUIRED);
      expect(modelDiagnostics).toHaveLength(1);
    });

    it('should not error when ModelProvider is provided', async () => {
      const mockModelProvider = {
        getType: async () => ({ type: 'String' as const, singleton: false }),
        getElementType: async () => undefined,
        ofType: () => ({ type: 'String' as const, singleton: false }),
        getElementNames: () => [],
        getChildrenType: async () => undefined,
        getElements: async () => [],
        getResourceTypes: async () => [],
        getComplexTypes: async () => [],
        getPrimitiveTypes: async () => [],
      };
      const result = await analyze('data.ofType(String)', { modelProvider: mockModelProvider });
      expect(result.diagnostics.filter(d => d.code === ErrorCodes.MODEL_PROVIDER_REQUIRED)).toHaveLength(0);
    });
  });

  describe('is operator', () => {
    it('should not require ModelProvider for is operator with primitive types', async () => {
      const result = await analyze('data is Boolean');
      expect(result.diagnostics.filter(d => d.code === ErrorCodes.MODEL_PROVIDER_REQUIRED)).toHaveLength(0);
    });

    it('should require ModelProvider for is operator with complex types', async () => {
      const result = await analyze('data is Patient');
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.code).toBe(ErrorCodes.MODEL_PROVIDER_REQUIRED);
    });
  });

  describe('as operator', () => {
    it('should not require ModelProvider for as operator with primitive types', async () => {
      const result = await analyze('data as Integer');
      expect(result.diagnostics.filter(d => d.code === ErrorCodes.MODEL_PROVIDER_REQUIRED)).toHaveLength(0);
    });

    it('should require ModelProvider for as operator with complex types', async () => {
      const result = await analyze('data as Observation');
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.code).toBe(ErrorCodes.MODEL_PROVIDER_REQUIRED);
    });
  });

  describe('multiple type operations', () => {
    it('should only report errors for non-primitive type operations without ModelProvider', async () => {
      const result = await analyze('data.ofType(String) | value is Boolean | item as Integer');
      // All operations use primitive types, so no ModelProvider required
      expect(result.diagnostics.filter(d => d.code === ErrorCodes.MODEL_PROVIDER_REQUIRED)).toHaveLength(0);
    });
  });
});