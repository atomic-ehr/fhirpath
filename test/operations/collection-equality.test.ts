import { describe, it, expect } from 'bun:test';
import { evaluate } from '../../src/index.node';

describe('Collection Equality Operations', () => {
  describe('= operator on collections', () => {
    it('should return true for identical collections in same order', async () => {
      expect(await evaluate('(1 | 2 | 3) = (1 | 2 | 3)')).toEqual([true]);
      expect(await evaluate("('a' | 'b' | 'c') = ('a' | 'b' | 'c')")).toEqual([true]);
      expect(await evaluate('(true | false | true) = (true | false | true)')).toEqual([true]);
    });

    it('should return false for collections with same items in different order', async () => {
      expect(await evaluate('(1 | 2 | 3) = (1 | 3 | 2)')).toEqual([false]);
      expect(await evaluate('(1 | 2 | 3) = (3 | 2 | 1)')).toEqual([false]);
      expect(await evaluate("('a' | 'b' | 'c') = ('c' | 'b' | 'a')")).toEqual([false]);
    });

    it('should return false for collections with different lengths', async () => {
      expect(await evaluate('(1 | 2) = (1 | 2 | 3)')).toEqual([false]);
      expect(await evaluate('(1 | 2 | 3) = (1 | 2)')).toEqual([false]);
      expect(await evaluate('(1) = (1 | 2)')).toEqual([false]);
    });

    it('should return false for collections with different items', async () => {
      expect(await evaluate('(1 | 2 | 3) = (4 | 5 | 6)')).toEqual([false]);
      expect(await evaluate('(1 | 2 | 3) = (1 | 2 | 4)')).toEqual([false]);
      expect(await evaluate("('a' | 'b') = ('x' | 'y')")).toEqual([false]);
    });

    it('should return empty for comparison with empty collection', async () => {
      expect(await evaluate('{} = (1 | 2 | 3)')).toEqual([]);
      expect(await evaluate('(1 | 2 | 3) = {}')).toEqual([]);
      expect(await evaluate('{} = {}')).toEqual([]);
    });

    it('should handle mixed types in collections', async () => {
      expect(await evaluate("(1 | 'a' | true) = (1 | 'a' | true)")).toEqual([true]);
      expect(await evaluate("(1 | 'a' | true) = (1 | 'a' | false)")).toEqual([false]);
    });

    it('should handle nested collections through union', async () => {
      expect(await evaluate('((1 | 2) | (3 | 4)) = (1 | 2 | 3 | 4)')).toEqual([true]);
      expect(await evaluate('(1 | 2).union((3 | 4)) = (1 | 2 | 3 | 4)')).toEqual([true]);
    });
  });

  describe('!= operator on collections', () => {
    it('should return false for identical collections in same order', async () => {
      expect(await evaluate('(1 | 2 | 3) != (1 | 2 | 3)')).toEqual([false]);
      expect(await evaluate("('a' | 'b' | 'c') != ('a' | 'b' | 'c')")).toEqual([false]);
      expect(await evaluate('(true | false | true) != (true | false | true)')).toEqual([false]);
    });

    it('should return true for collections with same items in different order', async () => {
      expect(await evaluate('(1 | 2 | 3) != (1 | 3 | 2)')).toEqual([true]);
      expect(await evaluate('(1 | 2 | 3) != (3 | 2 | 1)')).toEqual([true]);
      expect(await evaluate("('a' | 'b' | 'c') != ('c' | 'b' | 'a')")).toEqual([true]);
    });

    it('should return true for collections with different lengths', async () => {
      expect(await evaluate('(1 | 2) != (1 | 2 | 3)')).toEqual([true]);
      expect(await evaluate('(1 | 2 | 3) != (1 | 2)')).toEqual([true]);
      expect(await evaluate('(1) != (1 | 2)')).toEqual([true]);
    });

    it('should return true for collections with different items', async () => {
      expect(await evaluate('(1 | 2 | 3) != (4 | 5 | 6)')).toEqual([true]);
      expect(await evaluate('(1 | 2 | 3) != (1 | 2 | 4)')).toEqual([true]);
      expect(await evaluate("('a' | 'b') != ('x' | 'y')")).toEqual([true]);
    });

    it('should return empty for comparison with empty collection', async () => {
      expect(await evaluate('{} != (1 | 2 | 3)')).toEqual([]);
      expect(await evaluate('(1 | 2 | 3) != {}')).toEqual([]);
      expect(await evaluate('{} != {}')).toEqual([]);
    });

    it('should handle mixed types in collections', async () => {
      expect(await evaluate("(1 | 'a' | true) != (1 | 'a' | true)")).toEqual([false]);
      expect(await evaluate("(1 | 'a' | true) != (1 | 'a' | false)")).toEqual([true]);
    });
  });

  describe('Edge cases', () => {
    it('should handle single item vs collection comparison', async () => {
      // Single items are compared as single items
      expect(await evaluate('1 = 1')).toEqual([true]);
      expect(await evaluate('1 != 1')).toEqual([false]);
      
      // But collections with single item are still collections
      expect(await evaluate('(1) = (1)')).toEqual([true]);
      expect(await evaluate('(1) != (1)')).toEqual([false]);
    });

    it('should handle duplicate items in collections', async () => {
      expect(await evaluate('(1).combine((1)).combine((2)) = (1).combine((1)).combine((2))')).toEqual([true]);
      expect(await evaluate('(1).combine((1)).combine((2)) = (1).combine((2)).combine((1))')).toEqual([false]);
      expect(await evaluate('(1).combine((2)).combine((2)) = (1).combine((2)).combine((2))')).toEqual([true]);
    });

    it('should handle collections created by distinct()', async () => {
      expect(await evaluate('(1 | 2 | 2 | 3 | 1).distinct() = (1 | 2 | 3)')).toEqual([true]);
      expect(await evaluate('(3 | 2 | 1 | 1 | 2).distinct() = (1 | 2 | 3)')).toEqual([false]); // distinct doesn't guarantee order
    });
  });
});
