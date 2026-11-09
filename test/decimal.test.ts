import { describe, it, expect } from 'bun:test';
import { numericResultType, truncatedDivMod } from '../src/utils/decimal';

describe('truncatedDivMod', () => {
  it('computes the exact decimal quotient and remainder', () => {
    expect(truncatedDivMod(7.5, 2)).toEqual({ quotient: 3, remainder: 1.5 });
    expect(truncatedDivMod(10.125, 0.1)).toEqual({ quotient: 101, remainder: 0.025 });
    expect(truncatedDivMod(0.3, 0.1)).toEqual({ quotient: 3, remainder: 0 });
  });

  it('truncates toward zero and keeps the sign of the dividend', () => {
    expect(truncatedDivMod(-5.5, 0.7)).toEqual({ quotient: -7, remainder: -0.6 });
    expect(truncatedDivMod(5.5, -0.7)).toEqual({ quotient: -7, remainder: 0.6 });
    expect(truncatedDivMod(-7, 2)).toEqual({ quotient: -3, remainder: -1 });
  });

  it('handles numbers written in exponential form', () => {
    expect(truncatedDivMod(1e-7, 3e-8)).toEqual({ quotient: 3, remainder: 1e-8 });
    expect(truncatedDivMod(1e21, 7).remainder).toBe(6);
  });
});

describe('numericResultType', () => {
  it('applies implicit conversion Integer -> Long -> Decimal', () => {
    expect(numericResultType({ type: 'Integer', value: 1 }, { type: 'Decimal', value: 1 })).toBe('Decimal');
    expect(numericResultType({ type: 'Long', value: 1 }, { type: 'Integer', value: 2 })).toBe('Long');
    expect(numericResultType({ type: 'Integer', value: 1 }, { type: 'Integer', value: 2 })).toBe('Integer');
  });

  it('falls back to the value when the type is unknown', () => {
    expect(numericResultType({ type: 'Any', value: 1.5 }, { value: 2 })).toBe('Decimal');
    expect(numericResultType({ value: 3 }, { value: 2 })).toBe('Integer');
  });
});
