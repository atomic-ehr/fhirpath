import { describe, it, expect } from 'bun:test';
import { evaluate, FHIRModelProvider } from '../src/index';

describe('Type Operations', () => {
  const modelProvider = new FHIRModelProvider();
  
  describe('ofType function', () => {
    it('should filter strings', () => {
      const result = evaluate('("hello" | 123 | true).ofType(String)', { modelProvider });
      expect(result).toEqual(['hello']);
    });

    it('should filter integers', () => {
      const result = evaluate('("hello" | 123 | 45.6 | true).ofType(Integer)', { modelProvider });
      expect(result).toEqual([123]);
    });

    it('should filter booleans', () => {
      const result = evaluate('("hello" | 123 | true | false).ofType(Boolean)', { modelProvider });
      expect(result).toEqual([true, false]);
    });

    it('should return empty for no matches', () => {
      const result = evaluate('(123 | 456).ofType(String)', { modelProvider });
      expect(result).toEqual([]);
    });

    it('should filter resources by type', () => {
      const patient = { resourceType: 'Patient', id: '123' };
      const observation = { resourceType: 'Observation', id: '456' };
      const result = evaluate('$this.ofType(Patient)', { 
        input: [patient, observation],
        modelProvider
      });
      expect(result).toEqual([patient]);
    });
  });

  describe('is operator', () => {
    it('should test string type', () => {
      const result = evaluate('"hello" is String', { modelProvider });
      expect(result).toEqual([true]);
    });

    it('should test integer type', () => {
      const result = evaluate('123 is Integer', { modelProvider });
      expect(result).toEqual([true]);
    });

    it('should test decimal type', () => {
      const result = evaluate('45.6 is Decimal', { modelProvider });
      expect(result).toEqual([true]);
    });

    it('should test boolean type', () => {
      const result = evaluate('true is Boolean', { modelProvider });
      expect(result).toEqual([true]);
    });

    it('should return false for wrong type', () => {
      const result = evaluate('"hello" is Integer', { modelProvider });
      expect(result).toEqual([false]);
    });

    it('should handle empty collection', () => {
      const result = evaluate('(1 | 2).where(false) is String', { modelProvider });
      expect(result).toEqual([]);
    });

    it('should test resource type', () => {
      const patient = { resourceType: 'Patient', id: '123' };
      const result = evaluate('$this is Patient', { input: patient, modelProvider });
      expect(result).toEqual([true]);
    });
  });

  describe('as operator', () => {
    it('should cast matching string type', () => {
      const result = evaluate('"hello" as String', { modelProvider });
      expect(result).toEqual(['hello']);
    });

    it('should cast matching integer type', () => {
      const result = evaluate('123 as Integer', { modelProvider });
      expect(result).toEqual([123]);
    });

    it('should return empty for non-matching cast', () => {
      const result = evaluate('"hello" as Integer', { modelProvider });
      expect(result).toEqual([]);
    });

    it('should handle empty input', () => {
      const result = evaluate('empty() as String', { modelProvider });
      expect(result).toEqual([]);
    });

    it('should cast resource type', () => {
      const patient = { resourceType: 'Patient', id: '123' };
      const result = evaluate('$this as Patient', { input: patient, modelProvider });
      expect(result).toEqual([patient]);
    });

    it('should return empty for wrong resource type', () => {
      const observation = { resourceType: 'Observation', id: '456' };
      const result = evaluate('$this as Patient', { input: observation, modelProvider });
      expect(result).toEqual([]);
    });
  });
});