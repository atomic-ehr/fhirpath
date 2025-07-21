import { describe, it, expect } from 'bun:test';
import { evaluateFHIRPath } from '../../../src/interpreter/interpreter';

describe('Refactored Functions', () => {
  describe('substring with new signature', () => {
    it('propagates empty input without calling function', () => {
      // With propagateEmptyInput: true, the function should never be called for empty input
      const result = evaluateFHIRPath('substring(0)', []);
      expect(result).toEqual([]);
    });

    it('validates arguments with common validators', () => {
      // Should use nonNegativeInteger validator
      expect(() => evaluateFHIRPath("'hello'.substring(-1)", [])).toThrow('substring() start failed validation');
      expect(() => evaluateFHIRPath("'hello'.substring(0, -1)", [])).toThrow('substring() length failed validation');
    });

    it('deduces arity from arguments definition', () => {
      // Should allow 1 or 2 arguments (start is required, length is optional)
      expect(evaluateFHIRPath("'hello world'.substring(6)", [])).toEqual(['world']);
      expect(evaluateFHIRPath("'hello world'.substring(0, 5)", [])).toEqual(['hello']);
      expect(() => evaluateFHIRPath("'hello'.substring()", [])).toThrow('expects at least 1 arguments');
      expect(() => evaluateFHIRPath("'hello'.substring(0, 5, 10)", [])).toThrow('expects at most 2 arguments');
    });

    it('uses standalone function implementation', () => {
      // The substringFn is now a clean standalone function
      const result1 = evaluateFHIRPath("'hello world'.substring(6)", []);
      expect(result1).toEqual(['world']);
      
      const result2 = evaluateFHIRPath("'hello world'.substring(6, 5)", []);
      expect(result2).toEqual(['world']);
    });
  });

  describe('contains with new signature', () => {
    it('propagates empty input', () => {
      expect(evaluateFHIRPath("contains('test')", [])).toEqual([]);
    });

    it('uses cleaner function signature', () => {
      expect(evaluateFHIRPath("'hello world'.contains('world')", [])).toEqual([true]);
      expect(evaluateFHIRPath("'hello world'.contains('foo')", [])).toEqual([false]);
    });
  });

  describe('length with new signature', () => {
    it('propagates empty input', () => {
      expect(evaluateFHIRPath('length()', [])).toEqual([]);
    });

    it('works with no arguments', () => {
      expect(evaluateFHIRPath("'hello'.length()", [])).toEqual([5]);
    });
  });
});