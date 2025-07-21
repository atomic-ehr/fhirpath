import { describe, it, expect } from 'bun:test';
import { evaluateFHIRPath } from '../../../src/interpreter/interpreter';

describe('Enhanced String Functions', () => {
  describe('contains()', () => {
    it('should check if string contains substring', () => {
      expect(evaluateFHIRPath("'hello world'.contains('world')", [])).toEqual([true]);
      expect(evaluateFHIRPath("'hello world'.contains('foo')", [])).toEqual([false]);
    });

    it('should return empty for empty input', () => {
      expect(evaluateFHIRPath("contains('test')", [])).toEqual([]);
    });

    it('should validate argument type', () => {
      expect(() => evaluateFHIRPath("'hello'.contains(123)", [])).toThrow('contains() substring must be a string');
    });

    it('should require argument', () => {
      expect(() => evaluateFHIRPath("'hello'.contains()", [])).toThrow('Function contains expects at least 1 arguments, got 0');
    });
  });

  describe('length()', () => {
    it('should return string length', () => {
      expect(evaluateFHIRPath("'hello'.length()", [])).toEqual([5]);
      expect(evaluateFHIRPath("''.length()", [])).toEqual([0]);
    });

    it('should return empty for empty input', () => {
      expect(evaluateFHIRPath('length()', [])).toEqual([]);
    });

    it('should only work on strings', () => {
      expect(() => evaluateFHIRPath('123.length()', [])).toThrow('length() requires string input');
    });
  });

  describe('substring()', () => {
    it('should extract substring with start only', () => {
      expect(evaluateFHIRPath("'hello world'.substring(6)", [])).toEqual(['world']);
    });

    it('should extract substring with start and length', () => {
      expect(evaluateFHIRPath("'hello world'.substring(0, 5)", [])).toEqual(['hello']);
      expect(evaluateFHIRPath("'hello world'.substring(6, 5)", [])).toEqual(['world']);
    });

    it('should return empty string for out of bounds start', () => {
      expect(evaluateFHIRPath("'hello'.substring(10)", [])).toEqual(['']);
    });

    it('should return empty for empty input', () => {
      expect(evaluateFHIRPath('substring(0)', [])).toEqual([]);
    });

    it('should validate argument types', () => {
      expect(() => evaluateFHIRPath("'hello'.substring('not a number')", [])).toThrow('substring() start must be an integer');
      expect(() => evaluateFHIRPath("'hello'.substring(0, 'not a number')", [])).toThrow('substring() length must be an integer');
    });
  });

  describe('startsWith()', () => {
    it('should check if string starts with prefix', () => {
      expect(evaluateFHIRPath("'hello world'.startsWith('hello')", [])).toEqual([true]);
      expect(evaluateFHIRPath("'hello world'.startsWith('world')", [])).toEqual([false]);
    });

    it('should return empty for empty input', () => {
      expect(evaluateFHIRPath("startsWith('test')", [])).toEqual([]);
    });

    it('should validate argument type', () => {
      expect(() => evaluateFHIRPath("'hello'.startsWith(123)", [])).toThrow('startsWith() prefix must be a string');
    });
  });

  describe('endsWith()', () => {
    it('should check if string ends with suffix', () => {
      expect(evaluateFHIRPath("'hello world'.endsWith('world')", [])).toEqual([true]);
      expect(evaluateFHIRPath("'hello world'.endsWith('hello')", [])).toEqual([false]);
    });

    it('should return empty for empty input', () => {
      expect(evaluateFHIRPath("endsWith('test')", [])).toEqual([]);
    });

    it('should validate argument type', () => {
      expect(() => evaluateFHIRPath("'hello'.endsWith(123)", [])).toThrow('endsWith() suffix must be a string');
    });
  });
});