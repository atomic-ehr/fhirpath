import { describe, it, expect } from 'bun:test';
import { evaluate } from '../../src/index.node';

describe('hasValue() function', () => {
  describe('Primitive values', () => {
    it('should return true for string values', async () => {
      const result = await evaluate('"hello".hasValue()');
      expect(result).toEqual([true]);
    });

    it('should return true for numeric values', async () => {
      const result = await evaluate('42.hasValue()');
      expect(result).toEqual([true]);
    });

    it('should return true for decimal values', async () => {
      const result = await evaluate('3.14.hasValue()');
      expect(result).toEqual([true]);
    });

    it('should return true for boolean true', async () => {
      const result = await evaluate('true.hasValue()');
      expect(result).toEqual([true]);
    });

    it('should return true for boolean false', async () => {
      const result = await evaluate('false.hasValue()');
      expect(result).toEqual([true]);
    });

    it('should return true for date values', async () => {
      const result = await evaluate('@2024-01-01.hasValue()');
      expect(result).toEqual([true]);
    });

    it('should return true for datetime values', async () => {
      const result = await evaluate('@2024-01-01T12:00:00.hasValue()');
      expect(result).toEqual([true]);
    });

    it('should return true for time values', async () => {
      const result = await evaluate('@T12:00:00.hasValue()');
      expect(result).toEqual([true]);
    });

    it('should return empty for empty string', async () => {
      const result = await evaluate('"".hasValue()');
      expect(result).toEqual([]); // Empty string is considered as having no value in FHIR
    });

    it('should return true for whitespace-only string', async () => {
      const result = await evaluate('" ".hasValue()');
      expect(result).toEqual([true]); // Whitespace is still considered a value
    });

    it('should return true for zero', async () => {
      const result = await evaluate('0.hasValue()');
      expect(result).toEqual([true]);
    });
  });

  describe('Empty and non-existent values', () => {
    it('should return empty for empty collection', async () => {
      const result = await evaluate('({}).hasValue()');
      expect(result).toEqual([]);
    });

    it('should return empty for non-existent property', async () => {
      const input = { name: 'John' };
      const result = await evaluate('age.hasValue()', { input });
      expect(result).toEqual([]);
    });

    it('should return empty for multiple values', async () => {
      const result = await evaluate('(1 | 2 | 3).hasValue()');
      expect(result).toEqual([]);
    });

    it('should return true for single value in parentheses', async () => {
      // Parentheses around a single value don't make it a collection
      const result = await evaluate('(5).hasValue()');
      expect(result).toEqual([true]);
    });
  });

  describe('Complex objects', () => {
    it('should return empty for object values', async () => {
      const input = { 
        address: { 
          street: '123 Main St', 
          city: 'Boston' 
        } 
      };
      const result = await evaluate('address.hasValue()', { input });
      expect(result).toEqual([]); // Complex objects are not primitives
    });

    it('should return true for primitive within object', async () => {
      const input = { 
        address: { 
          street: '123 Main St', 
          city: 'Boston' 
        } 
      };
      const result = await evaluate('address.street.hasValue()', { input });
      expect(result).toEqual([true]);
    });

    it('should work with Quantity values', async () => {
      const input = {
        valueQuantity: {
          value: 185,
          unit: 'lbs'
        }
      };
      const result = await evaluate('valueQuantity.value.hasValue()', { input });
      expect(result).toEqual([true]);
    });

    it('should return empty for Quantity object itself', async () => {
      const input = {
        valueQuantity: {
          value: 185,
          unit: 'lbs'
        }
      };
      const result = await evaluate('valueQuantity.hasValue()', { input });
      expect(result).toEqual([]); // Quantity is a complex type, not a primitive
    });
  });

  describe('FHIR-specific scenarios', () => {
    it('should handle FHIR primitive with value', async () => {
      const input = {
        birthDate: '1974-12-25'
      };
      const result = await evaluate('birthDate.hasValue()', { input });
      expect(result).toEqual([true]);
    });

    it('should handle missing FHIR primitive', async () => {
      const input = {
        active: true
        // birthDate is missing
      };
      const result = await evaluate('birthDate.hasValue()', { input });
      expect(result).toEqual([]);
    });

    it('should return empty for _birthDate with extensions but no actual value', async () => {
      // FHIR scenario where _birthDate exists with extensions but birthDate value is omitted
      const input = {
        resourceType: 'Patient',
        id: 'example',
        _birthDate: {
          extension: [
            {
              url: 'http://example.org/fhir/StructureDefinition/birthdate-approximated',
              valueBoolean: true
            }
          ]
        }
        // Note: birthDate itself is missing - only _birthDate with extensions exists
      };
      const result = await evaluate('birthDate.hasValue()', { input });
      expect(result).toEqual([]); // No actual primitive value, only extensions
    });

    it('should return true when both birthDate and _birthDate exist', async () => {
      // FHIR scenario where both the value and extensions are present
      const input = {
        resourceType: 'Patient',
        id: 'example',
        birthDate: '1974-12-25',
        _birthDate: {
          extension: [
            {
              url: 'http://example.org/fhir/StructureDefinition/birthdate-approximated',
              valueBoolean: true
            }
          ]
        }
      };
      const result = await evaluate('birthDate.hasValue()', { input });
      expect(result).toEqual([true]); // Has actual primitive value
    });

    it('should work in period invariants', async () => {
      const input = {
        period: {
          start: '2020-01-01',
          end: '2020-12-31'
        }
      };
      const result = await evaluate(
        'period.start.hasValue() and period.end.hasValue()', 
        { input }
      );
      expect(result).toEqual([true]);
    });

    it('should work in period invariants with missing end', async () => {
      const input = {
        period: {
          start: '2020-01-01'
          // end is missing
        }
      };
      // When end doesn't exist, hasValue() returns empty, and not() of empty is empty
      // So the expression becomes: true and empty = empty
      const result = await evaluate(
        'period.start.hasValue() and period.end.hasValue().not()', 
        { input }
      );
      expect(result).toEqual([]); // Three-valued logic: true and empty = empty
    });

    it('should work with all() for validation', async () => {
      const input = {
        identifiers: [
          { system: 'http://example.org', value: '123' },
          { system: 'http://example.org', value: '456' },
          { system: 'http://example.org' } // Missing value
        ]
      };
      const result = await evaluate(
        'identifiers.all(value.hasValue())', 
        { input }
      );
      expect(result).toEqual([false]); // One identifier lacks a value
    });
  });

  describe('Type coercion and edge cases', () => {
    it('should handle null-like values correctly', async () => {
      // In FHIRPath, there's no null literal, but we can test with missing values
      const input = { value: null };
      const result = await evaluate('value.hasValue()', { input });
      expect(result).toEqual([]);
    });

    it('should handle undefined correctly', async () => {
      const input = { value: undefined };
      const result = await evaluate('value.hasValue()', { input });
      expect(result).toEqual([]);
    });

    it('should work with not() operator', async () => {
      const result = await evaluate('"test".hasValue().not()');
      expect(result).toEqual([false]);
    });

    it('should work with not() on empty', async () => {
      const input = {};
      const result = await evaluate('missing.hasValue().not()', { input });
      expect(result).toEqual([]); // not() of empty is empty
    });

    it('should be chainable with other functions', async () => {
      const input = {
        values: ['a', 'b', 'c']
      };
      const result = await evaluate(
        'values.where($this.hasValue()).count()', 
        { input }
      );
      expect(result).toEqual([3]);
    });
  });

  describe('Comparison with exists()', () => {
    it('should differ from exists() for primitives', async () => {
      const hasValueResult = await evaluate('"test".hasValue()');
      const existsResult = await evaluate('"test".exists()');
      expect(hasValueResult).toEqual([true]);
      expect(existsResult).toEqual([true]);
      // Both return true for primitives
    });

    it('should differ from exists() for empty collections', async () => {
      const hasValueResult = await evaluate('({}).hasValue()');
      const existsResult = await evaluate('({}).exists()');
      expect(hasValueResult).toEqual([]);
      expect(existsResult).toEqual([false]);
      // hasValue returns empty, exists returns false
    });

    it('should differ from exists() for complex objects', async () => {
      const input = { address: { city: 'Boston' } };
      const hasValueResult = await evaluate('address.hasValue()', { input });
      const existsResult = await evaluate('address.exists()', { input });
      expect(hasValueResult).toEqual([]);
      expect(existsResult).toEqual([true]);
      // hasValue returns empty (not a primitive), exists returns true
    });
  });
});