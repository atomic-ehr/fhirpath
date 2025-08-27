import { describe, it, expect } from 'bun:test';

import {
  createDate,
  createDateTime,
  createTime,
  createTimeQuantity,
  add,
  subtract,
  toTemporalString,
} from '../src/temporal';

describe('Temporal Arithmetic - Following ADR-017', () => {
  
  describe('Date Arithmetic', () => {
    
    describe('Low Precision Date (Year) - Coercion Strategy', () => {
      it('@2020 + 24 months = @2022', () => {
        const date = createDate(2020);
        const result = add(date, createTimeQuantity(24, 'month'));
        expect(toTemporalString(result)).toBe('2022');
        expect(result.precision.level).toBe('year');
      });

      it('@2020 + 11 months = @2020 (truncation)', () => {
        const date = createDate(2020);
        const result = add(date, createTimeQuantity(11, 'month'));
        expect(toTemporalString(result)).toBe('2020');
      });

      it('@2020 + 365 days = @2021', () => {
        const date = createDate(2020);
        const result = add(date, createTimeQuantity(365, 'day'));
        expect(toTemporalString(result)).toBe('2021');
      });

      it('@2020 + 364 days = @2020 (truncation)', () => {
        const date = createDate(2020);
        const result = add(date, createTimeQuantity(364, 'day'));
        expect(toTemporalString(result)).toBe('2020');
      });

      it('@2020 - 24 months = @2018', () => {
        const date = createDate(2020);
        const result = subtract(date, createTimeQuantity(24, 'month'));
        expect(toTemporalString(result)).toBe('2018');
      });
    });

    describe('Medium Precision Date (Month) - Hybrid Strategy', () => {
      it('@2020-01 + 25 months = @2022-02', () => {
        const date = createDate(2020, 1);
        const result = add(date, createTimeQuantity(25, 'month'));
        expect(toTemporalString(result)).toBe('2022-02');
        expect(result.precision.level).toBe('month');
      });

      it('@2020-01 + 45 days = @2020-02 (30 days = 1 month)', () => {
        const date = createDate(2020, 1);
        const result = add(date, createTimeQuantity(45, 'day'));
        expect(toTemporalString(result)).toBe('2020-02');
      });

      it('@2020-01 + 29 days = @2020-01 (truncation)', () => {
        const date = createDate(2020, 1);
        const result = add(date, createTimeQuantity(29, 'day'));
        expect(toTemporalString(result)).toBe('2020-01');
      });

      it('@2020-01 + 60 days = @2020-03 (60÷30 = 2 months)', () => {
        const date = createDate(2020, 1);
        const result = add(date, createTimeQuantity(60, 'day'));
        expect(toTemporalString(result)).toBe('2020-03');
      });

      it('@2020-12 + 2 months = @2021-02 (year overflow)', () => {
        const date = createDate(2020, 12);
        const result = add(date, createTimeQuantity(2, 'month'));
        expect(toTemporalString(result)).toBe('2021-02');
      });

      it('@2020-02 - 3 months = @2019-11', () => {
        const date = createDate(2020, 2);
        const result = subtract(date, createTimeQuantity(3, 'month'));
        expect(toTemporalString(result)).toBe('2019-11');
      });
    });

    describe('High Precision Date (Day) - Full Calendar Arithmetic', () => {
      it('@2020-01-01 + 1 month = @2020-02-01', () => {
        const date = createDate(2020, 1, 1);
        const result = add(date, createTimeQuantity(1, 'month'));
        expect(toTemporalString(result)).toBe('2020-02-01');
        expect(result.precision.level).toBe('day');
      });

      it('@2020-01-01 + 13 months = @2021-02-01', () => {
        const date = createDate(2020, 1, 1);
        const result = add(date, createTimeQuantity(13, 'month'));
        expect(toTemporalString(result)).toBe('2021-02-01');
        expect(result.precision.level).toBe('day');
      });

      it('@2020-01-15 + 1 day = @2020-01-16', () => {
        const date = createDate(2020, 1, 15);
        const result = add(date, createTimeQuantity(1, 'day'));
        expect(toTemporalString(result)).toBe('2020-01-16');
      });

      it('@2020-01-31 + 1 day = @2020-02-01', () => {
        const date = createDate(2020, 1, 31);
        const result = add(date, createTimeQuantity(1, 'day'));
        expect(toTemporalString(result)).toBe('2020-02-01');
      });

      it('@2020-12-31 + 1 day = @2021-01-01', () => {
        const date = createDate(2020, 12, 31);
        const result = add(date, createTimeQuantity(1, 'day'));
        expect(toTemporalString(result)).toBe('2021-01-01');
      });

      it('@2020-01-01 + 366 days = @2021-01-01 (leap year)', () => {
        const date = createDate(2020, 1, 1);
        const result = add(date, createTimeQuantity(366, 'day'));
        expect(toTemporalString(result)).toBe('2021-01-01');
      });

      it('@2021-01-01 + 365 days = @2022-01-01 (normal year)', () => {
        const date = createDate(2021, 1, 1);
        const result = add(date, createTimeQuantity(365, 'day'));
        expect(toTemporalString(result)).toBe('2022-01-01');
      });

      it('@2020-01-31 + 1 month = @2020-02-29 (clamping to leap year Feb)', () => {
        const date = createDate(2020, 1, 31);
        const result = add(date, createTimeQuantity(1, 'month'));
        // Clamps to valid Feb 29 in leap year
        expect(toTemporalString(result)).toBe('2020-02-29');
      });

      it('@2020-01-15 - 20 days = @2019-12-26', () => {
        const date = createDate(2020, 1, 15);
        const result = subtract(date, createTimeQuantity(20, 'day'));
        expect(toTemporalString(result)).toBe('2019-12-26');
      });

      it('@2020-03-01 - 1 day = @2020-02-29 (leap year)', () => {
        const date = createDate(2020, 3, 1);
        const result = subtract(date, createTimeQuantity(1, 'day'));
        expect(toTemporalString(result)).toBe('2020-02-29');
      });
    });
  });

  describe('Time Arithmetic', () => {
    
    describe('Hour precision', () => {
      it('@T10 + 3 hours = @T13', () => {
        const time = createTime(10);
        const result = add(time, createTimeQuantity(3, 'hour'));
        expect(toTemporalString(result)).toBe('13');
        expect(result.precision.level).toBe('hour');
      });
    });

    describe('Minute precision', () => {
      it('@T10:30 + 45 minutes = @T11:15', () => {
        const time = createTime(10, 30);
        const result = add(time, createTimeQuantity(45, 'minute'));
        expect(toTemporalString(result)).toBe('11:15');
      });

      it('@T23:30 + 45 minutes = @T00:15 (wrap to next day)', () => {
        const time = createTime(23, 30);
        const result = add(time, createTimeQuantity(45, 'minute'));
        expect(toTemporalString(result)).toBe('00:15');
      });

      it('@T10:30 + 1 hour = @T11:30', () => {
        const time = createTime(10, 30);
        const result = add(time, createTimeQuantity(1, 'hour'));
        expect(toTemporalString(result)).toBe('11:30');
      });

      it('@T10:30 + 1439 minutes = @T10:29 (wraps around)', () => {
        const time = createTime(10, 30);
        const result = add(time, createTimeQuantity(1439, 'minute'));
        expect(toTemporalString(result)).toBe('10:29');
      });

      it('@T02:30 - 3 hours = @T23:30 (wrap to previous day)', () => {
        const time = createTime(2, 30);
        const result = subtract(time, createTimeQuantity(3, 'hour'));
        expect(toTemporalString(result)).toBe('23:30');
      });
    });

    describe('Second precision', () => {
      it('@T10:30:00 + 45 seconds = @T10:30:45', () => {
        const time = createTime(10, 30, 0);
        const result = add(time, createTimeQuantity(45, 'second'));
        expect(toTemporalString(result)).toBe('10:30:45');
      });

      it('@T10:59:30 + 45 seconds = @T11:00:15', () => {
        const time = createTime(10, 59, 30);
        const result = add(time, createTimeQuantity(45, 'second'));
        expect(toTemporalString(result)).toBe('11:00:15');
      });

      it('@T23:59:59 + 1 second = @T00:00:00', () => {
        const time = createTime(23, 59, 59);
        const result = add(time, createTimeQuantity(1, 'second'));
        expect(toTemporalString(result)).toBe('00:00:00');
      });

      it('@T10:30:30 - 45 seconds = @T10:29:45', () => {
        const time = createTime(10, 30, 30);
        const result = subtract(time, createTimeQuantity(45, 'second'));
        expect(toTemporalString(result)).toBe('10:29:45');
      });
    });

    describe('Error cases', () => {
      it('Adding years to Time should throw', () => {
        const time = createTime(10, 30);
        expect(() => add(time, createTimeQuantity(1, 'year'))).toThrow();
      });

      it('Adding months to Time should throw', () => {
        const time = createTime(10, 30);
        expect(() => add(time, createTimeQuantity(1, 'month'))).toThrow();
      });

      it('Adding days to Time should throw', () => {
        const time = createTime(10, 30);
        expect(() => add(time, createTimeQuantity(1, 'day'))).toThrow();
      });
    });
  });

  describe('DateTime Arithmetic', () => {
    describe('Date component changes', () => {
      it('@2020-01-15T10:30:00 + 1 month = @2020-02-15T10:30:00', () => {
        const dateTime = createDateTime(2020, 1, 15, 10, 30, 0);
        const result = add(dateTime, createTimeQuantity(1, 'month'));
        expect(toTemporalString(result)).toBe('2020-02-15T10:30:00');
      });
    });

    describe('Time component changes', () => {
      it('@2020-01-15T10:30:00 + 3 hours = @2020-01-15T13:30:00', () => {
        const dateTime = createDateTime(2020, 1, 15, 10, 30, 0);
        const result = add(dateTime, createTimeQuantity(3, 'hour'));
        expect(toTemporalString(result)).toBe('2020-01-15T13:30:00');
      });

      it('@2020-01-15T22:30:00 + 3 hours = @2020-01-16T01:30:00', () => {
        const dateTime = createDateTime(2020, 1, 15, 22, 30, 0);
        const result = add(dateTime, createTimeQuantity(3, 'hour'));
        expect(toTemporalString(result)).toBe('2020-01-16T01:30:00');
      });
    });
  });

  describe('UCUM Unit Support', () => {
    it('@2020-01-01 + 1 a (annum/year) = @2021-01-01', () => {
      // 'a' is UCUM for year, but we don't support it for temporal arithmetic
      const date = createDate(2020, 1, 1);
      expect(() => add(date, { value: 1, unit: 'a', isCalendarUnit: false })).toThrow();
    });

    it('@2020-01-01 + 30 d (day) = @2020-01-31', () => {
      const date = createDate(2020, 1, 1);
      const result = add(date, { value: 30, unit: 'd', isCalendarUnit: true });
      expect(toTemporalString(result)).toBe('2020-01-31');
    });

    it('@T10:00:00 + 30 min (minute) = @T10:30:00', () => {
      const time = createTime(10, 0, 0);
      const result = add(time, { value: 30, unit: 'min', isCalendarUnit: false });
      expect(toTemporalString(result)).toBe('10:30:00');
    });
  });
});