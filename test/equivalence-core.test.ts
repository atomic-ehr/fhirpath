import { describe, it, expect } from 'bun:test';
import { equivalent, collectionsEquivalent, collectionsNotEquivalent } from '../src/comparison';
import { box } from '../src/boxing';

describe('Equivalence Core Functions', () => {
  describe('equivalent()', () => {
    describe('null/empty equivalence', () => {
      it('should treat null and undefined as equivalent', () => {
        expect(equivalent(null, undefined)).toBe(true);
        expect(equivalent(undefined, null)).toBe(true);
      });

      it('should treat empty array and null as equivalent', () => {
        expect(equivalent([], null)).toBe(true);
        expect(equivalent(null, [])).toBe(true);
      });

      it('should treat empty object and null as equivalent', () => {
        expect(equivalent({}, null)).toBe(true);
        expect(equivalent(null, {})).toBe(true);
      });

      it('should treat empty array and empty object as equivalent', () => {
        expect(equivalent([], {})).toBe(true);
        expect(equivalent({}, [])).toBe(true);
      });

      it('should not treat non-empty values as equivalent to null', () => {
        expect(equivalent([1], null)).toBe(false);
        expect(equivalent({ a: 1 }, null)).toBe(false);
        expect(equivalent('', null)).toBe(false);
        expect(equivalent(0, null)).toBe(false);
      });
    });

    describe('string equivalence', () => {
      it('should be case-insensitive', () => {
        expect(equivalent('ABC', 'abc')).toBe(true);
        expect(equivalent('Hello World', 'hello world')).toBe(true);
        expect(equivalent('FHIRPath', 'fhirpath')).toBe(true);
      });

      it('should normalize whitespace', () => {
        expect(equivalent('a  b', 'a b')).toBe(true);
        expect(equivalent('  hello  ', 'hello')).toBe(true);
        expect(equivalent('a\t\nb', 'a b')).toBe(true);
        expect(equivalent('multiple   spaces', 'multiple spaces')).toBe(true);
      });

      it('should handle both case and whitespace', () => {
        expect(equivalent('  HELLO   WORLD  ', 'hello world')).toBe(true);
        expect(equivalent('A\tB\nC', 'a b c')).toBe(true);
      });

      it('should not be equivalent when normalized strings differ', () => {
        expect(equivalent('abc', 'def')).toBe(false);
        expect(equivalent('hello', 'hello world')).toBe(false);
      });
    });

    describe('decimal equivalence', () => {
      it('should treat numbers with same value as equivalent', () => {
        expect(equivalent(2.0, 2.00)).toBe(true);
        expect(equivalent(1.000, 1)).toBe(true);
        expect(equivalent(3.14159, 3.14159)).toBe(true);
      });

      it('should handle scientific notation', () => {
        expect(equivalent(1e2, 100)).toBe(true);
        expect(equivalent(1.5e3, 1500)).toBe(true);
      });

      it('should handle special values', () => {
        expect(equivalent(NaN, NaN)).toBe(true);
        expect(equivalent(Infinity, Infinity)).toBe(true);
        expect(equivalent(-Infinity, -Infinity)).toBe(true);
      });

      it('should not be equivalent for different values', () => {
        expect(equivalent(1.0, 2.0)).toBe(false);
        expect(equivalent(NaN, 0)).toBe(false);
        expect(equivalent(Infinity, -Infinity)).toBe(false);
      });
    });

    describe('boolean equivalence', () => {
      it('should use strict equality for booleans', () => {
        expect(equivalent(true, true)).toBe(true);
        expect(equivalent(false, false)).toBe(true);
        expect(equivalent(true, false)).toBe(false);
        expect(equivalent(false, true)).toBe(false);
      });
    });

    describe('type mismatch', () => {
      it('should return false for different types', () => {
        expect(equivalent('1', 1)).toBe(false);
        expect(equivalent(true, 'true')).toBe(false);
        expect(equivalent([], 'array')).toBe(false);
      });

      it('should handle null/empty specially', () => {
        expect(equivalent(null, [])).toBe(true);
        expect(equivalent({}, undefined)).toBe(true);
      });
    });

    describe('deep equivalence', () => {
      it('should compare objects deeply using equivalence rules', () => {
        expect(equivalent(
          { name: 'JOHN', age: 30 },
          { name: 'john', age: 30.0 }
        )).toBe(true);
      });

      it('should compare arrays deeply using equivalence rules', () => {
        expect(equivalent(
          ['ABC', 1.0, true],
          ['abc', 1.00, true]
        )).toBe(true);
      });

      it('should handle nested structures', () => {
        expect(equivalent(
          { user: { name: 'ALICE', scores: [1.0, 2.00] } },
          { user: { name: 'alice', scores: [1, 2.0] } }
        )).toBe(true);
      });

      it('should return false for structurally different objects', () => {
        expect(equivalent(
          { a: 1, b: 2 },
          { a: 1, c: 2 }
        )).toBe(false);
      });
    });
  });

  describe('collectionsEquivalent()', () => {
    it('should treat empty collections as equivalent', () => {
      expect(collectionsEquivalent([], [])).toBe(true);
    });

    it('should compare single element collections', () => {
      expect(collectionsEquivalent(
        [box('ABC')],
        [box('abc')]
      )).toBe(true);
      
      expect(collectionsEquivalent(
        [box(1.0)],
        [box(1.00)]
      )).toBe(true);
    });

    it('should be order-independent', () => {
      expect(collectionsEquivalent(
        [box(1), box(2), box(3)],
        [box(3), box(1), box(2)]
      )).toBe(true);
      
      expect(collectionsEquivalent(
        [box('a'), box('b'), box('c')],
        [box('C'), box('A'), box('B')]
      )).toBe(true);
    });

    it('should handle duplicates correctly (multiset semantics)', () => {
      expect(collectionsEquivalent(
        [box(1), box(1), box(2)],
        [box(1), box(2), box(1)]
      )).toBe(true);
      
      expect(collectionsEquivalent(
        [box(1), box(1), box(2)],
        [box(1), box(2), box(2)]
      )).toBe(false);
    });

    it('should use equivalence rules for elements', () => {
      expect(collectionsEquivalent(
        [box('ABC'), box(1.0), box(true)],
        [box('abc'), box(1.00), box(true)]
      )).toBe(true);
    });

    it('should return false for different lengths', () => {
      expect(collectionsEquivalent(
        [box(1), box(2)],
        [box(1), box(2), box(3)]
      )).toBe(false);
    });

    it('should return false when only one collection is empty', () => {
      expect(collectionsEquivalent([], [box(1)])).toBe(false);
      expect(collectionsEquivalent([box(1)], [])).toBe(false);
    });

    it('should handle mixed types with proper sorting', () => {
      expect(collectionsEquivalent(
        [box(true), box('abc'), box(1), box(false)],
        [box('ABC'), box(false), box(1.0), box(true)]
      )).toBe(true);
    });
  });

  describe('collectionsNotEquivalent()', () => {
    it('should return opposite of collectionsEquivalent', () => {
      expect(collectionsNotEquivalent([], [])).toBe(false);
      
      expect(collectionsNotEquivalent(
        [box(1), box(2)],
        [box(2), box(1)]
      )).toBe(false);
      
      expect(collectionsNotEquivalent(
        [box(1), box(2)],
        [box(1), box(3)]
      )).toBe(true);
    });

    it('should handle null results properly', () => {
      // If collectionsEquivalent returns null, so should notEquivalent
      // This would happen if element comparison returns null
      // For now, our equivalent() doesn't return null, but the infrastructure supports it
    });
  });
});