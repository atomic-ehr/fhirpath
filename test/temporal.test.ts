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
  newTime,
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

    it('should parse partial date', () => {
      const date: Date = parse('2025-01') as Date;
      expect(date.precision).toBe(TemoralPrecision.Month);
      expect(date.year).toBe(2025);
      expect(date.month).toBe(1);
    });
  });

  describe('Precision and arithmetics', () => {

    it('Add 30 days to Date with Month precision, month precision keeps, day component didn\'t add, 30 days behaves as 1 month equivalent', () => {
        const date:Date = newDate(2025, 1);
        expect(date.precision).toBe(TemoralPrecision.Month);
        const result = add(date, newTimeQuantity(30, TemoralPrecision.Day));
        expect(result.precision).toBe(TemoralPrecision.Month);
        expect(result.month).toBe(2);
        expect(result.day).toBeUndefined();
    });

    it('Add 1 month to Date with Day precision, day precision keeps, month is updated', () => {
        const date:Date = newDate(2025, 1, 1);
        expect(date.precision).toBe(TemoralPrecision.Day);
        const result = add(date, newTimeQuantity(1, TemoralPrecision.Month));
        expect(result.precision).toBe(TemoralPrecision.Day);
        expect(result.month).toBe(2);
    });

    it('Add 12 months to Date with Day precision, day precision keeps, year is updated, we used month component in this case', () => {
        const date:Date = newDate(2025, 1, 1);
        expect(date.precision).toBe(TemoralPrecision.Day);
        const result = add(date, newTimeQuantity(12, TemoralPrecision.Month));
        expect(result.precision).toBe(TemoralPrecision.Day);
        expect(result.year).toBe(2026);
        expect(result.month).toBe(1);
        expect(result.day).toBe(1);
    });

    it('Add 1 second to Time with Hour precision, now we have seconds precision, minutes set to 0', () => {
        const time:Time = newTime(12);
        expect(time.precision).toBe(TemoralPrecision.Hour);
        const result = add(time, newTimeQuantity(1, TemoralPrecision.Second));
        expect(result.precision).toBe(TemoralPrecision.Second);
        expect(result.hour).toBe(12);
        expect(result.minute).toBe(0);
        expect(result.second).toBe(1);
    });
  });
});
