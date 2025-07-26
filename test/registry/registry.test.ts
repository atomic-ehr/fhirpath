import { describe, it, expect, beforeEach } from 'bun:test';
import { Registry } from '../../src/registry';
import { TokenType } from '../../src/lexer/token';

describe('Registry', () => {
  beforeEach(() => {
    // Registry is populated on module load
  });

  describe('operator registration', () => {
    it('should register arithmetic operators', () => {
      const plus = Registry.get('+');
      expect(plus).toBeDefined();
      expect(plus?.kind).toBe('operator');
      expect((plus as any).syntax.token).toBe(TokenType.PLUS);
      
      const minus = Registry.get('-');
      expect(minus).toBeDefined();
      expect((minus as any).syntax.token).toBe(TokenType.MINUS);
    });

    it('should register logical operators', () => {
      const and = Registry.get('and');
      expect(and).toBeDefined();
      expect(and?.kind).toBe('operator');
      expect((and as any).syntax.token).toBe(TokenType.AND);
      
      const not = Registry.get('not');
      expect(not).toBeDefined();
      expect(not?.kind).toBe('function'); // 'not' is now a function, not an operator
    });

    it('should provide operator precedence', () => {
      expect(Registry.getPrecedence(TokenType.STAR)).toBe(10); // multiplication
      expect(Registry.getPrecedence(TokenType.PLUS)).toBe(9); // addition
      expect(Registry.getPrecedence(TokenType.AND)).toBe(3); // logical and
      expect(Registry.getPrecedence(TokenType.OR)).toBe(2); // logical or
    });

    it('should identify keywords', () => {
      expect(Registry.isKeyword('and')).toBe(true);
      expect(Registry.isKeyword('or')).toBe(true);
      expect(Registry.isKeyword('not')).toBe(false); // 'not' is now a function, not a keyword
      expect(Registry.isKeyword('true')).toBe(true);
      expect(Registry.isKeyword('false')).toBe(true);
      expect(Registry.isKeyword('mod')).toBe(true);
      expect(Registry.isKeyword('div')).toBe(true);
      expect(Registry.isKeyword('randomword')).toBe(false);
    });
  });

  describe('literal registration', () => {
    it('should match integer literals', () => {
      const match = Registry.matchLiteral('123');
      expect(match).toBeDefined();
      expect(match?.operation.name).toBe('integer-literal');
      expect(match?.value).toBe(123);
    });

    it('should match decimal literals', () => {
      const match = Registry.matchLiteral('123.45');
      expect(match).toBeDefined();
      expect(match?.operation.name).toBe('decimal-literal');
      expect(match?.value).toBe(123.45);
    });

    it('should match boolean literals', () => {
      const trueMatch = Registry.matchLiteral('true');
      expect(trueMatch).toBeDefined();
      expect(trueMatch?.value).toBe(true);

      const falseMatch = Registry.matchLiteral('false');
      expect(falseMatch).toBeDefined();
      expect(falseMatch?.value).toBe(false);
    });

    it('should match string literals', () => {
      const match = Registry.matchLiteral("'hello world'");
      expect(match).toBeDefined();
      expect(match?.operation.name).toBe('string-literal');
      expect(match?.value).toBe('hello world');
    });

    it('should match datetime literals', () => {
      const match = Registry.matchLiteral('@2023-01-15T10:30:00Z');
      expect(match).toBeDefined();
      expect(match?.operation.name).toBe('datetime-literal');
      expect(match?.value).toBeInstanceOf(Date);
    });

    it('should match time literals', () => {
      const match = Registry.matchLiteral('@T14:30:00');
      expect(match).toBeDefined();
      expect(match?.operation.name).toBe('time-literal');
      expect(match?.value).toEqual({
        hour: 14,
        minute: 30,
        second: 0,
        millisecond: 0
      });
    });

    it('should match quantity literals', () => {
      const match = Registry.matchLiteral("5.4 'mg'");
      expect(match).toBeDefined();
      expect(match?.operation.name).toBe('quantity-literal');
      expect(match?.value).toEqual({
        value: 5.4,
        unit: 'mg'
      });
    });
  });

  describe('function registration', () => {
    it('should register existence functions', () => {
      expect(Registry.get('exists')).toBeDefined();
      expect(Registry.get('empty')).toBeDefined();
      expect(Registry.get('count')).toBeDefined();
      expect(Registry.get('first')).toBeDefined();
      expect(Registry.get('last')).toBeDefined();
      expect(Registry.get('single')).toBeDefined();
    });

    it('should return function definitions', () => {
      const exists = Registry.get('exists');
      expect(exists?.kind).toBe('function');
      expect((exists as any).signature.output.type).toBe('Boolean');
    });
  });

  describe('lookup methods', () => {
    it('should lookup by token', () => {
      const plus = Registry.getByToken(TokenType.PLUS);
      expect(plus).toBeDefined();
      expect(plus?.name).toBe('+');
    });

    it('should get all operations', () => {
      const all = Registry.getAllOperations();
      expect(all.length).toBeGreaterThan(20); // Should have many operations
    });

    it('should get operators by form', () => {
      const prefix = Registry.getOperatorsByForm('prefix');
      expect(prefix.some(op => op.name === 'unary+')).toBe(true); // unary plus
      expect(prefix.some(op => op.name === 'unary-')).toBe(true); // unary minus
      // 'not' is no longer a prefix operator

      const infix = Registry.getOperatorsByForm('infix');
      expect(infix.some(op => op.name === '+')).toBe(true);
      expect(infix.some(op => op.name === 'and')).toBe(true);
    });

    it('should get all functions', () => {
      const functions = Registry.getAllFunctions();
      expect(functions.some(f => f.name === 'exists')).toBe(true);
      expect(functions.some(f => f.name === 'count')).toBe(true);
    });
  });
});