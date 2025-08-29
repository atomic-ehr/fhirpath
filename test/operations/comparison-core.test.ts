import { describe, it, expect } from 'bun:test';
import { compare, compareCollections, collectionsEqual, collectionsNotEqual, deepEqual, type ComparisonResult } from '../../src/operations/comparison';
import { box } from '../../src/interpreter/boxing';

describe('Core Comparison System', () => {
  describe('compare()', () => {
    describe('Primitive comparisons', () => {
      it('should compare numbers correctly', () => {
        expect(compare(5, 5)).toEqual({ kind: 'equal' });
        expect(compare(3, 5)).toEqual({ kind: 'less' });
        expect(compare(7, 5)).toEqual({ kind: 'greater' });
      });

      it('should compare strings correctly', () => {
        expect(compare('hello', 'hello')).toEqual({ kind: 'equal' });
        expect(compare('apple', 'banana')).toEqual({ kind: 'less' });
        expect(compare('zebra', 'apple')).toEqual({ kind: 'greater' });
      });

      it('should compare booleans correctly', () => {
        expect(compare(true, true)).toEqual({ kind: 'equal' });
        expect(compare(false, false)).toEqual({ kind: 'equal' });
        expect(compare(false, true)).toEqual({ kind: 'less' }); // false < true
        expect(compare(true, false)).toEqual({ kind: 'greater' });
      });

      it('should handle null and undefined', () => {
        expect(compare(null, null)).toEqual({ kind: 'equal' });
        expect(compare(undefined, undefined)).toEqual({ kind: 'equal' });
        expect(compare(null, undefined)).toEqual({ kind: 'incomparable', reason: 'null or undefined value' });
        expect(compare(5, null)).toEqual({ kind: 'incomparable', reason: 'null or undefined value' });
        expect(compare(undefined, 'test')).toEqual({ kind: 'incomparable', reason: 'null or undefined value' });
      });

      it('should handle type mismatches', () => {
        expect(compare(5, 'five')).toEqual({ kind: 'incomparable', reason: 'type mismatch' });
        expect(compare(true, 1)).toEqual({ kind: 'incomparable', reason: 'type mismatch' });
        expect(compare('false', false)).toEqual({ kind: 'incomparable', reason: 'type mismatch' });
      });
    });

    describe('Temporal comparisons', () => {
      it('should compare Date values', () => {
        const date1 = { kind: 'FHIRDate' as const, year: 2023, month: 3, day: 15 };
        const date2 = { kind: 'FHIRDate' as const, year: 2023, month: 3, day: 15 };
        const date3 = { kind: 'FHIRDate' as const, year: 2023, month: 3, day: 20 };
        
        expect(compare(date1, date2)).toEqual({ kind: 'equal' });
        expect(compare(date1, date3)).toEqual({ kind: 'less' });
        expect(compare(date3, date1)).toEqual({ kind: 'greater' });
      });

      it('should handle incomparable temporal values', () => {
        const date1 = { kind: 'FHIRDate' as const, year: 2023 };
        const date2 = { kind: 'FHIRDate' as const, year: 2023, month: 3 };
        
        const result = compare(date1, date2);
        expect(result.kind).toBe('incomparable');
      });
    });

    describe('Quantity comparisons', () => {
      it('should compare quantities with same units', () => {
        const q1 = { value: 5, unit: 'kg' };
        const q2 = { value: 5, unit: 'kg' };
        const q3 = { value: 10, unit: 'kg' };
        
        expect(compare(q1, q2)).toEqual({ kind: 'equal' });
        expect(compare(q1, q3)).toEqual({ kind: 'less' });
        expect(compare(q3, q1)).toEqual({ kind: 'greater' });
      });

      it('should compare dimensionless quantities with numbers', () => {
        const q1 = { value: 5, unit: '1' };
        const q2 = { value: 5, unit: '' };
        
        expect(compare(q1, 5)).toEqual({ kind: 'equal' });
        expect(compare(q2, 5)).toEqual({ kind: 'equal' });
        expect(compare(5, q1)).toEqual({ kind: 'equal' });
        expect(compare(q1, 3)).toEqual({ kind: 'greater' });
        expect(compare(3, q1)).toEqual({ kind: 'less' });
      });

      it('should not compare dimensioned quantities with numbers', () => {
        const q = { value: 5, unit: 'kg' };
        
        expect(compare(q, 5)).toEqual({ kind: 'incomparable', reason: 'cannot compare dimensioned quantity to number' });
        expect(compare(5, q)).toEqual({ kind: 'incomparable', reason: 'cannot compare dimensioned quantity to number' });
      });
    });

    describe('Complex type comparisons', () => {
      it('should use deep equality for objects', () => {
        const obj1 = { a: 1, b: 'test', c: true };
        const obj2 = { a: 1, b: 'test', c: true };
        const obj3 = { a: 1, b: 'test', c: false };
        
        expect(compare(obj1, obj2)).toEqual({ kind: 'equal' });
        const result = compare(obj1, obj3);
        expect(result.kind).toBe('incomparable');
        if (result.kind === 'incomparable') {
          expect(result.reason).toBe('complex types not equal');
        }
      });

      it('should use deep equality for arrays', () => {
        const arr1 = [1, 2, 3];
        const arr2 = [1, 2, 3];
        const arr3 = [1, 2, 4];
        
        expect(compare(arr1, arr2)).toEqual({ kind: 'equal' });
        const result = compare(arr1, arr3);
        expect(result.kind).toBe('incomparable');
      });
    });
  });

  describe('compareCollections()', () => {
    it('should handle empty collections', () => {
      const empty: any[] = [];
      const nonEmpty = [box(1)];
      
      expect(compareCollections(empty, nonEmpty)).toEqual({ kind: 'incomparable', reason: 'empty collection' });
      expect(compareCollections(nonEmpty, empty)).toEqual({ kind: 'incomparable', reason: 'empty collection' });
      expect(compareCollections(empty, empty)).toEqual({ kind: 'incomparable', reason: 'empty collection' });
    });

    it('should compare single value collections', () => {
      const col1 = [box(5)];
      const col2 = [box(5)];
      const col3 = [box(10)];
      
      expect(compareCollections(col1, col2)).toEqual({ kind: 'equal' });
      expect(compareCollections(col1, col3)).toEqual({ kind: 'less' });
      expect(compareCollections(col3, col1)).toEqual({ kind: 'greater' });
    });

    it('should compare multiple value collections element by element', () => {
      const col1 = [box(1), box(2), box(3)];
      const col2 = [box(1), box(2), box(3)];
      const col3 = [box(1), box(2), box(4)];
      
      expect(compareCollections(col1, col2)).toEqual({ kind: 'equal' });
      expect(compareCollections(col1, col3)).toEqual({ kind: 'less' });
    });

    it('should handle different length collections', () => {
      const col1 = [box(1), box(2)];
      const col2 = [box(1), box(2), box(3)];
      
      expect(compareCollections(col1, col2)).toEqual({ kind: 'incomparable', reason: 'different collection lengths' });
    });

    it('should stop at first non-equal element', () => {
      const col1 = [box(1), box(2), box(3)];
      const col2 = [box(1), box(5), box(3)];
      
      expect(compareCollections(col1, col2)).toEqual({ kind: 'less' });
    });
  });

  describe('collectionsEqual() and collectionsNotEqual()', () => {
    it('should return boolean for comparable collections', () => {
      const col1 = [box(1), box(2), box(3)];
      const col2 = [box(1), box(2), box(3)];
      const col3 = [box(1), box(2), box(4)];
      
      expect(collectionsEqual(col1, col2)).toBe(true);
      expect(collectionsEqual(col1, col3)).toBe(false);
      expect(collectionsNotEqual(col1, col2)).toBe(false);
      expect(collectionsNotEqual(col1, col3)).toBe(true);
    });

    it('should return false/true for different length collections', () => {
      const col1 = [box(1), box(2)];
      const col2 = [box(1), box(2), box(3)];
      
      // Different lengths are definitively not equal
      expect(collectionsEqual(col1, col2)).toBe(false);
      expect(collectionsNotEqual(col1, col2)).toBe(true);
    });

    it('should return null for incomparable collections', () => {
      const empty: any[] = [];
      const nonEmpty = [box(1)];
      
      expect(collectionsEqual(empty, nonEmpty)).toBe(null);
      expect(collectionsNotEqual(empty, nonEmpty)).toBe(null);
    });
  });

  describe('deepEqual()', () => {
    it('should handle primitive values', () => {
      expect(deepEqual(5, 5)).toBe(true);
      expect(deepEqual('test', 'test')).toBe(true);
      expect(deepEqual(true, true)).toBe(true);
      expect(deepEqual(null, null)).toBe(true);
      expect(deepEqual(undefined, undefined)).toBe(true);
      
      expect(deepEqual(5, 10)).toBe(false);
      expect(deepEqual('test', 'other')).toBe(false);
      expect(deepEqual(true, false)).toBe(false);
      expect(deepEqual(null, undefined)).toBe(false);
    });

    it('should handle arrays', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(deepEqual(['a', 'b'], ['a', 'b'])).toBe(true);
      expect(deepEqual([], [])).toBe(true);
      
      expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
      expect(deepEqual([1, 2, 3], [1, 3, 2])).toBe(false);
    });

    it('should handle nested arrays', () => {
      expect(deepEqual([[1, 2], [3, 4]], [[1, 2], [3, 4]])).toBe(true);
      expect(deepEqual([[1, 2], [3, 4]], [[1, 2], [3, 5]])).toBe(false);
    });

    it('should handle objects', () => {
      expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
      expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true); // Order independent
      expect(deepEqual({}, {})).toBe(true);
      
      expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
      expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
      expect(deepEqual({ a: 1, b: 2 }, { a: 1, c: 2 })).toBe(false);
    });

    it('should handle nested objects', () => {
      expect(deepEqual(
        { a: { b: { c: 1 } } },
        { a: { b: { c: 1 } } }
      )).toBe(true);
      
      expect(deepEqual(
        { a: { b: { c: 1 } } },
        { a: { b: { c: 2 } } }
      )).toBe(false);
    });

    it('should handle mixed nested structures', () => {
      const obj1 = {
        arr: [1, 2, { nested: 'value' }],
        obj: { key: 'value', arr: [1, 2, 3] }
      };
      const obj2 = {
        arr: [1, 2, { nested: 'value' }],
        obj: { key: 'value', arr: [1, 2, 3] }
      };
      const obj3 = {
        arr: [1, 2, { nested: 'different' }],
        obj: { key: 'value', arr: [1, 2, 3] }
      };
      
      expect(deepEqual(obj1, obj2)).toBe(true);
      expect(deepEqual(obj1, obj3)).toBe(false);
    });

    it('should handle temporal values', () => {
      const date1 = { kind: 'FHIRDate' as const, year: 2023, month: 3, day: 15 };
      const date2 = { kind: 'FHIRDate' as const, year: 2023, month: 3, day: 15 };
      const date3 = { kind: 'FHIRDate' as const, year: 2023, month: 3, day: 20 };
      
      expect(deepEqual(date1, date2)).toBe(true);
      expect(deepEqual(date1, date3)).toBe(false);
    });

    it('should handle quantity values', () => {
      const q1 = { value: 5, unit: 'kg' };
      const q2 = { value: 5, unit: 'kg' };
      const q3 = { value: 10, unit: 'kg' };
      
      expect(deepEqual(q1, q2)).toBe(true);
      expect(deepEqual(q1, q3)).toBe(false);
    });

    it('should handle same reference', () => {
      const obj = { a: 1, b: 2 };
      const arr = [1, 2, 3];
      
      expect(deepEqual(obj, obj)).toBe(true);
      expect(deepEqual(arr, arr)).toBe(true);
    });
  });
});