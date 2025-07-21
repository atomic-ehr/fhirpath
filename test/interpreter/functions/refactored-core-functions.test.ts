import { describe, it, expect } from 'bun:test';
import { evaluateFHIRPath } from '../../../src/interpreter/interpreter';

describe('Refactored Core Functions', () => {
  describe('iif()', () => {
    it('evaluates then branch when condition is true', () => {
      const result = evaluateFHIRPath("iif(true, 'yes', 'no')", []);
      expect(result).toEqual(['yes']);
    });

    it('evaluates else branch when condition is false', () => {
      const result = evaluateFHIRPath("iif(false, 'yes', 'no')", []);
      expect(result).toEqual(['no']);
    });

    it('treats empty as false', () => {
      const result = evaluateFHIRPath("iif({}, 'yes', 'no')", []);
      expect(result).toEqual(['no']);
    });

    it('only evaluates needed branch (lazy evaluation)', () => {
      // This would error if both branches were evaluated
      const result = evaluateFHIRPath("iif(true, 1, 1/0)", []);
      expect(result).toEqual([1]);
    });
  });

  describe('defineVariable()', () => {
    it('adds variable to context', () => {
      const result = evaluateFHIRPath("defineVariable('x', 5) | %x", []);
      expect(result).toEqual([5]);
    });

    it('variable is available in subsequent expressions', () => {
      const result = evaluateFHIRPath("defineVariable('name', 'John').select(%name + ' Doe')", [1]);
      expect(result).toEqual(['John Doe']);
    });

    it('returns original input', () => {
      const result = evaluateFHIRPath("defineVariable('x', 10)", [1, 2, 3]);
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('trace()', () => {
    it('returns input unchanged', () => {
      const result = evaluateFHIRPath("trace('test')", [1, 2, 3]);
      expect(result).toEqual([1, 2, 3]);
    });

    it('can trace with selector', () => {
      const result = evaluateFHIRPath("trace('doubled', $this * 2)", [5]);
      expect(result).toEqual([5]);
    });
  });

  describe('where()', () => {
    it('filters collection based on criteria', () => {
      const result = evaluateFHIRPath('where($this > 2)', [1, 2, 3, 4]);
      expect(result).toEqual([3, 4]);
    });

    it('has access to $this in predicate', () => {
      const result = evaluateFHIRPath('where($this.active)', [
        { name: 'John', active: true },
        { name: 'Jane', active: false },
        { name: 'Bob', active: true }
      ]);
      expect(result).toEqual([
        { name: 'John', active: true },
        { name: 'Bob', active: true }
      ]);
    });
  });

  describe('select()', () => {
    it('transforms each element', () => {
      const result = evaluateFHIRPath('select($this * 2)', [1, 2, 3]);
      expect(result).toEqual([2, 4, 6]);
    });

    it('can navigate properties', () => {
      const result = evaluateFHIRPath('select(name)', [
        { name: 'John' },
        { name: 'Jane' }
      ]);
      expect(result).toEqual(['John', 'Jane']);
    });
  });
});