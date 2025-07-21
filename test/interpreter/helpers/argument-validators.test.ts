import { describe, it, expect } from 'bun:test';
import { ArgumentValidators } from '../../../src/interpreter/helpers/argument-validators';

describe('ArgumentValidators', () => {
  describe('requireString', () => {
    it('should extract valid string argument', () => {
      const result = ArgumentValidators.requireString([['hello']], 0, 'test', 'arg1');
      expect(result).toBe('hello');
    });

    it('should throw on empty argument', () => {
      expect(() => ArgumentValidators.requireString([[]], 0, 'test', 'arg1'))
        .toThrow('test() requires arg1 argument');
    });

    it('should throw on missing argument', () => {
      expect(() => ArgumentValidators.requireString([], 0, 'test', 'arg1'))
        .toThrow('test() requires arg1 argument');
    });

    it('should throw on non-string argument', () => {
      expect(() => ArgumentValidators.requireString([[42]], 0, 'test', 'arg1'))
        .toThrow('test() arg1 must be a string');
    });
  });

  describe('requireInteger', () => {
    it('should extract valid integer argument', () => {
      const result = ArgumentValidators.requireInteger([[42]], 0, 'test', 'count');
      expect(result).toBe(42);
    });

    it('should throw on decimal', () => {
      expect(() => ArgumentValidators.requireInteger([[42.5]], 0, 'test', 'count'))
        .toThrow('test() count must be an integer');
    });

    it('should throw on string', () => {
      expect(() => ArgumentValidators.requireInteger([['42']], 0, 'test', 'count'))
        .toThrow('test() count must be an integer');
    });
  });

  describe('requireDecimal', () => {
    it('should accept integer as decimal', () => {
      const result = ArgumentValidators.requireDecimal([[42]], 0, 'test', 'value');
      expect(result).toBe(42);
    });

    it('should accept decimal', () => {
      const result = ArgumentValidators.requireDecimal([[42.5]], 0, 'test', 'value');
      expect(result).toBe(42.5);
    });

    it('should throw on string', () => {
      expect(() => ArgumentValidators.requireDecimal([['42.5']], 0, 'test', 'value'))
        .toThrow('test() value must be a number');
    });
  });

  describe('requireBoolean', () => {
    it('should extract valid boolean argument', () => {
      expect(ArgumentValidators.requireBoolean([[true]], 0, 'test', 'flag')).toBe(true);
      expect(ArgumentValidators.requireBoolean([[false]], 0, 'test', 'flag')).toBe(false);
    });

    it('should throw on non-boolean', () => {
      expect(() => ArgumentValidators.requireBoolean([['true']], 0, 'test', 'flag'))
        .toThrow('test() flag must be a boolean');
    });
  });

  describe('optionalString', () => {
    it('should return string when present', () => {
      const result = ArgumentValidators.optionalString([['hello']], 0, 'test', 'arg1');
      expect(result).toBe('hello');
    });

    it('should return undefined when empty', () => {
      const result = ArgumentValidators.optionalString([[]], 0, 'test', 'arg1');
      expect(result).toBeUndefined();
    });

    it('should return undefined when missing', () => {
      const result = ArgumentValidators.optionalString([], 0, 'test', 'arg1');
      expect(result).toBeUndefined();
    });

    it('should throw on wrong type', () => {
      expect(() => ArgumentValidators.optionalString([[42]], 0, 'test', 'arg1'))
        .toThrow('test() arg1 must be a string');
    });
  });

  describe('requireCollection', () => {
    it('should return collection as-is', () => {
      const collection = [1, 2, 3];
      const result = ArgumentValidators.requireCollection([collection], 0, 'test', 'items');
      expect(result).toBe(collection);
    });

    it('should accept empty collection', () => {
      const result = ArgumentValidators.requireCollection([[]], 0, 'test', 'items');
      expect(result).toEqual([]);
    });

    it('should throw on missing argument', () => {
      expect(() => ArgumentValidators.requireCollection([], 0, 'test', 'items'))
        .toThrow('test() requires items argument');
    });
  });

  describe('requireSingleton', () => {
    it('should extract single value', () => {
      const result = ArgumentValidators.requireSingleton([['value']], 0, 'test', 'arg');
      expect(result).toBe('value');
    });

    it('should throw on empty', () => {
      expect(() => ArgumentValidators.requireSingleton([[]], 0, 'test', 'arg'))
        .toThrow('test() requires arg argument');
    });

    it('should throw on multiple values', () => {
      expect(() => ArgumentValidators.requireSingleton([['a', 'b']], 0, 'test', 'arg'))
        .toThrow('test() arg must be a single value');
    });
  });
});