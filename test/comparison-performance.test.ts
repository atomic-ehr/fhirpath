import { describe, it, expect } from 'bun:test';
import { compare, compareWithCache, collectionsEqual, deepEqual } from '../src/comparison';
import { createDateTime } from '../src/temporal';
import type { QuantityValue } from '../src/quantity-value';
import { box } from '../src/boxing';

/**
 * Performance benchmark tests for the comparison system
 * These tests measure the performance improvements from optimization strategies
 */

describe('Comparison Performance Benchmarks', () => {
  // Helper to measure execution time
  function measureTime(fn: () => void, iterations: number = 1000): number {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    const end = performance.now();
    return end - start;
  }

  describe('Reference Equality Optimization', () => {
    it('should be fast for identical references', () => {
      const obj = { a: 1, b: { c: 2, d: [1, 2, 3] } };
      const iterations = 100000;
      
      const time = measureTime(() => {
        compare(obj, obj);
      }, iterations);
      
      // Reference equality should be very fast - under 1ms for 100k iterations
      expect(time).toBeLessThan(10);
      console.log(`Reference equality: ${time}ms for ${iterations} iterations`);
    });

    it('should be fast for primitive comparisons', () => {
      const iterations = 100000;
      
      const time = measureTime(() => {
        compare(42, 42);
        compare('hello', 'hello');
        compare(true, false);
      }, iterations);
      
      // Primitive comparisons should be very fast
      expect(time).toBeLessThan(50);
      console.log(`Primitive comparisons: ${time}ms for ${iterations * 3} comparisons`);
    });
  });

  describe('Type Mismatch Early Exit', () => {
    it('should quickly detect type mismatches', () => {
      const iterations = 100000;
      
      const time = measureTime(() => {
        compare(42, 'string');
        compare(true, 123);
        compare(null, {});
      }, iterations);
      
      // Type mismatches should be detected immediately
      expect(time).toBeLessThan(50);
      console.log(`Type mismatch detection: ${time}ms for ${iterations * 3} comparisons`);
    });
  });

  describe('Temporal UTC Caching', () => {
    it('should cache UTC conversions for repeated comparisons', () => {
      const dt1 = createDateTime(2024, 3, 15, 12, 0, 0, 0, -300);
      const dt2 = createDateTime(2024, 3, 15, 17, 0, 0, 0, 0);
      const iterations = 10000;
      
      // First run - will populate cache
      const firstTime = measureTime(() => {
        compare(dt1, dt2);
      }, iterations);
      
      // Second run - should use cache
      const secondTime = measureTime(() => {
        compare(dt1, dt2);
      }, iterations);
      
      // Second run should be faster due to caching
      // Allow some variance but expect improvement
      console.log(`Temporal UTC conversion - First: ${firstTime}ms, Second: ${secondTime}ms`);
      expect(secondTime).toBeLessThanOrEqual(firstTime * 1.1); // Allow 10% variance
    });
  });

  describe('Comparison Result Caching', () => {
    it('should cache comparison results for complex objects', () => {
      const obj1 = {
        patient: {
          name: [
            { given: ['John', 'James'], family: 'Doe' },
            { given: ['J', 'J'], family: 'Doe', use: 'usual' }
          ],
          birthDate: '1970-01-01',
          active: true
        }
      };
      
      const obj2 = {
        patient: {
          name: [
            { given: ['Jane', 'Mary'], family: 'Smith' },
            { given: ['J', 'M'], family: 'Smith', use: 'usual' }
          ],
          birthDate: '1975-05-15',
          active: true
        }
      };
      
      const iterations = 5000;
      
      // First comparison using regular compare
      const regularTime = measureTime(() => {
        compare(obj1, obj2);
      }, iterations);
      
      // Using cached comparison
      const cachedTime1 = measureTime(() => {
        compareWithCache(obj1, obj2);
      }, 1); // Prime the cache
      
      const cachedTime2 = measureTime(() => {
        compareWithCache(obj1, obj2);
      }, iterations);
      
      console.log(`Complex object comparison - Regular: ${regularTime}ms, Cached: ${cachedTime2}ms`);
      // Cached should be faster or similar for repeated comparisons
      // Allow some variance due to timing fluctuations
      expect(cachedTime2).toBeLessThanOrEqual(regularTime * 0.8);
    });
  });

  describe('Collection Equality Performance', () => {
    it('should exit early for different length collections', () => {
      const arr1 = Array(1000).fill(0).map((_, i) => box({ value: i }));
      const arr2 = Array(500).fill(0).map((_, i) => box({ value: i }));
      const iterations = 10000;
      
      const time = measureTime(() => {
        collectionsEqual(arr1, arr2);
      }, iterations);
      
      // Should be very fast due to length check
      expect(time).toBeLessThan(10);
      console.log(`Collection length mismatch: ${time}ms for ${iterations} comparisons`);
    });
    
    it('should be efficient for large equal collections', () => {
      const arr1 = Array(100).fill(0).map((_, i) => box({ value: i }));
      const arr2 = Array(100).fill(0).map((_, i) => box({ value: i }));
      const iterations = 1000;
      
      const time = measureTime(() => {
        collectionsEqual(arr1, arr2);
      }, iterations);
      
      console.log(`Large collection equality: ${time}ms for ${iterations} comparisons of 100-element arrays`);
      // Should complete in reasonable time
      expect(time).toBeLessThan(5000);
    });
  });

  describe('Deep Equality Performance', () => {
    it('should handle deeply nested structures efficiently', () => {
      const createNested = (depth: number): any => {
        if (depth === 0) return { value: 42 };
        return { child: createNested(depth - 1), level: depth };
      };
      
      const obj1 = createNested(10);
      const obj2 = createNested(10);
      const obj3 = createNested(10);
      obj3.level = 999; // Make it different at top level
      
      const iterations = 5000;
      
      const equalTime = measureTime(() => {
        deepEqual(obj1, obj2);
      }, iterations);
      
      const notEqualTime = measureTime(() => {
        deepEqual(obj1, obj3);
      }, iterations);
      
      console.log(`Deep equality - Equal: ${equalTime}ms, Not Equal: ${notEqualTime}ms`);
      // Not equal should be faster or similar due to early exit
      // Allow 20% variance for timing fluctuations
      expect(notEqualTime).toBeLessThanOrEqual(equalTime * 1.2);
    });
  });

  describe('Quantity Comparison Performance', () => {
    it('should efficiently compare quantities with cached UCUM conversions', () => {
      const q1: QuantityValue = { value: 5, unit: 'kg' };
      const q2: QuantityValue = { value: 5000, unit: 'g' };
      const iterations = 10000;
      
      // First comparison - will initialize UCUM quantities
      const firstTime = measureTime(() => {
        compare(q1, q2);
      }, 10);
      
      // Subsequent comparisons - should use cached UCUM quantities
      const cachedTime = measureTime(() => {
        compare(q1, q2);
      }, iterations);
      
      console.log(`Quantity comparison - Initial: ${firstTime}ms for 10, Cached: ${cachedTime}ms for ${iterations}`);
      // Performance should be consistent after initial UCUM creation
      expect(cachedTime).toBeLessThan(iterations * 0.1); // Less than 0.1ms per comparison
    });
  });

  describe('Overall Performance Summary', () => {
    it('should show performance characteristics', () => {
      const results: string[] = [];
      
      // Test 1: Reference equality
      const obj = { test: true };
      const refTime = measureTime(() => compare(obj, obj), 100000);
      results.push(`Reference equality: ${refTime.toFixed(2)}ms for 100k comparisons`);
      
      // Test 2: Primitive comparison
      const primTime = measureTime(() => compare(42, 43), 100000);
      results.push(`Primitive comparison: ${primTime.toFixed(2)}ms for 100k comparisons`);
      
      // Test 3: Type mismatch
      const typeTime = measureTime(() => compare(42, 'string'), 100000);
      results.push(`Type mismatch: ${typeTime.toFixed(2)}ms for 100k comparisons`);
      
      // Test 4: Collection length mismatch
      const arr1 = [box(1), box(2), box(3)];
      const arr2 = [box(1), box(2)];
      const lenTime = measureTime(() => collectionsEqual(arr1, arr2), 100000);
      results.push(`Collection length mismatch: ${lenTime.toFixed(2)}ms for 100k comparisons`);
      
      // Test 5: Complex object with cache
      const complex = { a: { b: { c: [1, 2, 3] } } };
      measureTime(() => compareWithCache(complex, complex), 1); // Prime cache
      const cacheTime = measureTime(() => compareWithCache(complex, complex), 100000);
      results.push(`Cached complex comparison: ${cacheTime.toFixed(2)}ms for 100k comparisons`);
      
      console.log('\n=== Performance Summary ===');
      results.forEach(r => console.log(r));
      console.log('===========================\n');
      
      // All operations should be reasonably fast
      expect(refTime).toBeLessThan(10);
      expect(primTime).toBeLessThan(50);
      expect(typeTime).toBeLessThan(50);
      expect(lenTime).toBeLessThan(10);
      expect(cacheTime).toBeLessThan(10);
    });
  });
});