import { describe, it, expect } from 'bun:test';
import { InputValidators } from '../../../src/interpreter/helpers/input-validators';

describe('InputValidators', () => {
  describe('requireStringInput', () => {
    it('should extract valid string input', () => {
      const result = InputValidators.requireStringInput(['hello'], 'test');
      expect(result).toBe('hello');
    });

    it('should throw on empty input', () => {
      expect(() => InputValidators.requireStringInput([], 'test'))
        .toThrow('test() requires a string input');
    });

    it('should throw on non-string input', () => {
      expect(() => InputValidators.requireStringInput([42], 'test'))
        .toThrow('test() requires a string input');
    });

    it('should throw on multiple values', () => {
      expect(() => InputValidators.requireStringInput(['a', 'b'], 'test'))
        .toThrow('Expected single value but got 2 items');
    });
  });

  describe('requireNumberInput', () => {
    it('should extract valid number input', () => {
      const result = InputValidators.requireNumberInput([42.5], 'test');
      expect(result).toBe(42.5);
    });

    it('should throw on empty input', () => {
      expect(() => InputValidators.requireNumberInput([], 'test'))
        .toThrow('test() requires a number input');
    });

    it('should throw on non-number input', () => {
      expect(() => InputValidators.requireNumberInput(['42'], 'test'))
        .toThrow('test() requires a number input');
    });
  });

  describe('requireBooleanInput', () => {
    it('should extract valid boolean input', () => {
      expect(InputValidators.requireBooleanInput([true], 'test')).toBe(true);
      expect(InputValidators.requireBooleanInput([false], 'test')).toBe(false);
    });

    it('should throw on empty input', () => {
      expect(() => InputValidators.requireBooleanInput([], 'test'))
        .toThrow('test() requires a boolean input');
    });

    it('should throw on non-boolean input', () => {
      expect(() => InputValidators.requireBooleanInput(['true'], 'test'))
        .toThrow('test() requires a boolean input');
    });
  });

  describe('requireNonEmptyInput', () => {
    it('should return non-empty input', () => {
      const input = [1, 2, 3];
      const result = InputValidators.requireNonEmptyInput(input, 'test');
      expect(result).toBe(input);
    });

    it('should throw on empty input', () => {
      expect(() => InputValidators.requireNonEmptyInput([], 'test'))
        .toThrow('test() requires non-empty input');
    });
  });

  describe('handleEmptyInput', () => {
    it('should return isEmpty true for empty input', () => {
      const result = InputValidators.handleEmptyInput([], 'default');
      expect(result).toEqual({ isEmpty: true, value: 'default' });
    });

    it('should return isEmpty false for non-empty input', () => {
      const result = InputValidators.handleEmptyInput([1, 2], 'default');
      expect(result).toEqual({ isEmpty: false });
    });
  });

  describe('getSingleton', () => {
    it('should return single value', () => {
      const result = InputValidators.getSingleton(['value']);
      expect(result).toBe('value');
    });

    it('should return undefined for empty', () => {
      const result = InputValidators.getSingleton([]);
      expect(result).toBeUndefined();
    });

    it('should return undefined for multiple values', () => {
      const result = InputValidators.getSingleton(['a', 'b']);
      expect(result).toBeUndefined();
    });
  });

  describe('requireSingleton', () => {
    it('should extract single value', () => {
      const result = InputValidators.requireSingleton(['value'], 'test');
      expect(result).toBe('value');
    });

    it('should throw on empty', () => {
      expect(() => InputValidators.requireSingleton([], 'test'))
        .toThrow('test() requires non-empty input');
    });

    it('should throw on multiple values', () => {
      expect(() => InputValidators.requireSingleton(['a', 'b'], 'test'))
        .toThrow('test() requires single value input');
    });
  });
});