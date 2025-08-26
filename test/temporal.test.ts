import { describe, it, expect } from 'bun:test';

import {
  TemoralPrecision,
  DateTimePrecisionMap,
  type TemporalValue,
  type Date,
  type DateTime,
  type Time,
  type TimeQuantity,
  parse,
  add,
  subtract,
  toDateTime,
  newDate,
  newTimeQuantity
} from '../src/temporal';

describe('Temporal', () => {

  describe('parser', () => {
    it('should parse date', () => {
      const date: Date = parse('2025-01-01') as Date; 
      expect(date.precision).toBe(TemoralPrecision.Day);
      expect(date.year).toBe(2025);
      expect(date.month).toBe(1);
      expect(date.day).toBe(1);
    });
  });

  describe('TemoralPrecision enum', () => {
    it('should have correct precision values', () => {
        const date:Date = newDate(2025, 1, 1);
        expect(date.precision).toBe(TemoralPrecision.Day);
        const result = add(date, newTimeQuantity(1, TemoralPrecision.Month));
        expect(result.precision).toBe(TemoralPrecision.Day);
        expect(result.month).toBe(2);

    });
  });
});
