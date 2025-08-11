import { describe, it, expect, beforeAll } from 'bun:test';
import { evaluate, FHIRModelProvider } from '../src/index';

describe('Type Operations', () => {
  let modelProvider: FHIRModelProvider;
  
  beforeAll(async () => {
    modelProvider = new FHIRModelProvider();
    await modelProvider.initialize();
    // Load types used in tests for caching
    await Promise.all([
      modelProvider.getSchema('Patient'),
      modelProvider.getSchema('Observation')
    ]);
  });
  
  describe('ofType function', () => {
    it('should filter strings', async () => {
      const result = await evaluate('("hello" | 123 | true).ofType(String)', { modelProvider });
      expect(result).toEqual(['hello']);
    });

    it('should filter integers', async () => {
      const result = await evaluate('("hello" | 123 | 45.6 | true).ofType(Integer)', { modelProvider });
      expect(result).toEqual([123]);
    });

    it('should filter booleans', async () => {
      const result = await evaluate('("hello" | 123 | true | false).ofType(Boolean)', { modelProvider });
      expect(result).toEqual([true, false]);
    });

    it('should return empty for no matches', async () => {
      const result = await evaluate('(123 | 456).ofType(String)', { modelProvider });
      expect(result).toEqual([]);
    });

    it('should filter resources by type', async () => {
      const patient = { resourceType: 'Patient', id: '123' };
      const observation = { resourceType: 'Observation', id: '456' };
      const result = await evaluate('$this.ofType(Patient)', { 
        input: [patient, observation],
        modelProvider
      });
      expect(result).toEqual([patient]);
    });
  });

  describe('is operator', () => {
    it('should test string type', async () => {
      const result = await evaluate('"hello" is String', { modelProvider });
      expect(result).toEqual([true]);
    });

    it('should test integer type', async () => {
      const result = await evaluate('123 is Integer', { modelProvider });
      expect(result).toEqual([true]);
    });

    it('should test decimal type', async () => {
      const result = await evaluate('45.6 is Decimal', { modelProvider });
      expect(result).toEqual([true]);
    });

    it('should test boolean type', async () => {
      const result = await evaluate('true is Boolean', { modelProvider });
      expect(result).toEqual([true]);
    });

    it('should return false for wrong type', async () => {
      const result = await evaluate('"hello" is Integer', { modelProvider });
      expect(result).toEqual([false]);
    });

    it('should handle empty collection', async () => {
      const result = await evaluate('(1 | 2).where(false) is String', { modelProvider });
      expect(result).toEqual([]);
    });

    it('should test resource type', async () => {
      const patient = { resourceType: 'Patient', id: '123' };
      const result = await evaluate('$this is Patient', { input: patient, modelProvider });
      expect(result).toEqual([true]);
    });
  });

  describe('as operator', () => {
    it('should cast matching string type', async () => {
      const result = await evaluate('"hello" as String', { modelProvider });
      expect(result).toEqual(['hello']);
    });

    it('should cast matching integer type', async () => {
      const result = await evaluate('123 as Integer', { modelProvider });
      expect(result).toEqual([123]);
    });

    it('should return empty for non-matching cast', async () => {
      const result = await evaluate('"hello" as Integer', { modelProvider });
      expect(result).toEqual([]);
    });

    it('should handle empty input', async () => {
      const result = await evaluate('empty() as String', { modelProvider });
      expect(result).toEqual([]);
    });

    it('should cast resource type', async () => {
      const patient = { resourceType: 'Patient', id: '123' };
      const result = await evaluate('$this as Patient', { input: patient, modelProvider });
      expect(result).toEqual([patient]);
    });

    it('should return empty for wrong resource type', async () => {
      const observation = { resourceType: 'Observation', id: '456' };
      const result = await evaluate('$this as Patient', { input: observation, modelProvider });
      expect(result).toEqual([]);
    });
  });
});