import { describe, it, expect } from 'bun:test';

import {
  createDate,
  createDateTime,
  createTime,
  createTimeQuantity,
} from '../src/temporal';

describe('Temporal Arithmetic - Following ADR-017', () => {
  
  describe('Date Arithmetic', () => {
    
    describe('Low Precision Date (Year) - Coercion Strategy', () => {
      it('@2020 + 24 months = @2022', () => {
        const date = createDate(2020);
        const result = date.add(createTimeQuantity(24, 'month'));
        expect(result.toString()).toBe('2022');
        expect(result.precision.level).toBe('year');
      });

      it('@2020 + 11 months = @2020 (truncation)', () => {
        const date = createDate(2020);
        const result = date.add(createTimeQuantity(11, 'month'));
        expect(result.toString()).toBe('2020');
      });

      it('@2020 + 365 days = @2021', () => {
        const date = createDate(2020);
        const result = date.add(createTimeQuantity(365, 'day'));
        expect(result.toString()).toBe('2021');
      });

      it('@2020 + 364 days = @2020 (truncation)', () => {
        const date = createDate(2020);
        const result = date.add(createTimeQuantity(364, 'day'));
        expect(result.toString()).toBe('2020');
      });

      it('@2020 - 24 months = @2018', () => {
        const date = createDate(2020);
        const result = date.subtract(createTimeQuantity(24, 'month'));
        expect(result.toString()).toBe('2018');
      });
    });

    describe('Medium Precision Date (Month) - Hybrid Strategy', () => {
      it('@2020-01 + 25 months = @2022-02', () => {
        const date = createDate(2020, 1);
        const result = date.add(createTimeQuantity(25, 'month'));
        expect(result.toString()).toBe('2022-02');
        expect(result.precision.level).toBe('month');
      });

      it('@2020-01 + 45 days = @2020-02 (30 days = 1 month)', () => {
        const date = createDate(2020, 1);
        const result = date.add(createTimeQuantity(45, 'day'));
        expect(result.toString()).toBe('2020-02');
      });

      it('@2020-01 + 29 days = @2020-01 (truncation)', () => {
        const date = createDate(2020, 1);
        const result = date.add(createTimeQuantity(29, 'day'));
        expect(result.toString()).toBe('2020-01');
      });

      it('@2020-01 + 60 days = @2020-03 (60÷30 = 2 months)', () => {
        const date = createDate(2020, 1);
        const result = date.add(createTimeQuantity(60, 'day'));
        expect(result.toString()).toBe('2020-03');
      });

      it('@2020-12 + 2 months = @2021-02 (year overflow)', () => {
        const date = createDate(2020, 12);
        const result = date.add(createTimeQuantity(2, 'month'));
        expect(result.toString()).toBe('2021-02');
      });

      it('@2020-02 - 3 months = @2019-11', () => {
        const date = createDate(2020, 2);
        const result = date.subtract(createTimeQuantity(3, 'month'));
        expect(result.toString()).toBe('2019-11');
      });
    });

    describe('High Precision Date (Day) - Full Calendar Arithmetic', () => {
      it('@2020-01-01 + 13 months = @2021-02-01', () => {
        const date = createDate(2020, 1, 1);
        const result = date.add(createTimeQuantity(13, 'month'));
        expect(result.toString()).toBe('2021-02-01');
        expect(result.precision.level).toBe('day');
      });

      it('@2020-01-31 + 1 month = @2020-02-29 (month-end in leap year)', () => {
        const date = createDate(2020, 1, 31);
        const result = date.add(createTimeQuantity(1, 'month'));
        expect(result.toString()).toBe('2020-02-29');
      });

      it('@2021-01-31 + 1 month = @2021-02-28 (month-end in non-leap year)', () => {
        const date = createDate(2021, 1, 31);
        const result = date.add(createTimeQuantity(1, 'month'));
        expect(result.toString()).toBe('2021-02-28');
      });

      it('@2020-03-31 + 1 month = @2020-04-30 (April has 30 days)', () => {
        const date = createDate(2020, 3, 31);
        const result = date.add(createTimeQuantity(1, 'month'));
        expect(result.toString()).toBe('2020-04-30');
      });

      it('@2020-02-29 + 1 year = @2021-02-28 (leap year adjustment)', () => {
        const date = createDate(2020, 2, 29);
        const result = date.add(createTimeQuantity(1, 'year'));
        expect(result.toString()).toBe('2021-02-28');
      });

      it('@2020-12-31 + 1 day = @2021-01-01 (year rollover)', () => {
        const date = createDate(2020, 12, 31);
        const result = date.add(createTimeQuantity(1, 'day'));
        expect(result.toString()).toBe('2021-01-01');
      });

      it('@2020-01-01 + 1 week = @2020-01-08', () => {
        const date = createDate(2020, 1, 1);
        const result = date.add(createTimeQuantity(1, 'week'));
        expect(result.toString()).toBe('2020-01-08');
      });

      it('@2021-03-01 - 1 day = @2021-02-28', () => {
        const date = createDate(2021, 3, 1);
        const result = date.subtract(createTimeQuantity(1, 'day'));
        expect(result.toString()).toBe('2021-02-28');
      });

      it('@2020-03-01 - 1 day = @2020-02-29 (leap year)', () => {
        const date = createDate(2020, 3, 1);
        const result = date.subtract(createTimeQuantity(1, 'day'));
        expect(result.toString()).toBe('2020-02-29');
      });
    });
  });

  describe('Time Arithmetic', () => {
    
    describe('Low Precision Time - Coercion Strategy', () => {
      it('@T10 + 90 minutes = @T11 (90÷60=1.5, truncate to 1)', () => {
        const time = createTime(10);
        const result = time.add(createTimeQuantity(90, 'minute'));
        expect(result.toString()).toBe('11');
        expect(result.precision.level).toBe('hour');
      });

      it('@T10:30 + 45 seconds = @T10:30 (45÷60=0.75, truncate to 0)', () => {
        const time = createTime(10, 30);
        const result = time.add(createTimeQuantity(45, 'second'));
        expect(result.toString()).toBe('10:30');
      });

      it('@T10 + 3700 seconds = @T11 (3700÷3600=1.02, truncate to 1)', () => {
        const time = createTime(10);
        const result = time.add(createTimeQuantity(3700, 'second'));
        expect(result.toString()).toBe('11');
      });

      it('@T23 + 2 hours = @T01 (wrapping)', () => {
        const time = createTime(23);
        const result = time.add(createTimeQuantity(2, 'hour'));
        expect(result.toString()).toBe('01');
      });

      it('@T02 - 3 hours = @T23 (wrapping)', () => {
        const time = createTime(2);
        const result = time.subtract(createTimeQuantity(3, 'hour'));
        expect(result.toString()).toBe('23');
      });
    });

    describe('High Precision Time - Clock Arithmetic', () => {
      it('@T10:30:45 + 30 seconds = @T10:31:15', () => {
        const time = createTime(10, 30, 45);
        const result = time.add(createTimeQuantity(30, 'second'));
        expect(result.toString()).toBe('10:31:15');
      });

      it('@T23:45:00 + 30 minutes = @T00:15:00 (day wrap)', () => {
        const time = createTime(23, 45, 0);
        const result = time.add(createTimeQuantity(30, 'minute'));
        expect(result.toString()).toBe('00:15:00');
      });

      it('@T10:30:45.500 + 750 milliseconds = @T10:30:46.250', () => {
        const time = createTime(10, 30, 45, 500);
        const result = time.add(createTimeQuantity(750, 'millisecond'));
        expect(result.toString()).toBe('10:30:46.250');
      });

      it('@T00:00:30 - 45 seconds = @T23:59:45 (previous day)', () => {
        const time = createTime(0, 0, 30);
        const result = time.subtract(createTimeQuantity(45, 'second'));
        expect(result.toString()).toBe('23:59:45');
      });
    });

    describe('Time cannot accept calendar units', () => {
      it('should throw when adding years to Time', () => {
        const time = createTime(10, 30);
        expect(() => time.add(createTimeQuantity(1, 'year'))).toThrow('Cannot add calendar unit year to Time value');
      });

      it('should throw when adding months to Time', () => {
        const time = createTime(10, 30);
        expect(() => time.add(createTimeQuantity(1, 'month'))).toThrow('Cannot add calendar unit month to Time value');
      });
    });
  });

  describe('DateTime Arithmetic', () => {
    
    describe('Low Precision DateTime - Coercion Strategy', () => {
      it('@2020T + 365 days = @2021T', () => {
        const dt = createDateTime(2020);
        const result = dt.add(createTimeQuantity(365, 'day'));
        expect(result.toString()).toBe('2021T');
        expect(result.precision.level).toBe('year');
      });

      it('@2020-01T + 48 hours = @2020-01T (48÷24=2 days, 2÷30=0.06 months, truncate)', () => {
        const dt = createDateTime(2020, 1);
        const result = dt.add(createTimeQuantity(48, 'hour'));
        expect(result.toString()).toBe('2020-01T');
      });

      it('@2020-01T + 720 hours = @2020-02T (720÷24=30 days = 1 month)', () => {
        const dt = createDateTime(2020, 1);
        const result = dt.add(createTimeQuantity(720, 'hour'));
        expect(result.toString()).toBe('2020-02T');
      });
    });

    describe('High Precision DateTime - Calendar/Clock Arithmetic', () => {
      it('@2020-01-31T10:30:00 + 1 month = @2020-02-29T10:30:00', () => {
        const dt = createDateTime(2020, 1, 31, 10, 30, 0);
        const result = dt.add(createTimeQuantity(1, 'month'));
        expect(result.toString()).toBe('2020-02-29T10:30:00');
      });

      it('@2020-12-31T23:30:00 + 45 minutes = @2021-01-01T00:15:00', () => {
        const dt = createDateTime(2020, 12, 31, 23, 30, 0);
        const result = dt.add(createTimeQuantity(45, 'minute'));
        expect(result.toString()).toBe('2021-01-01T00:15:00');
      });

      it('@2020-01-01T10:30 + 90 seconds = @2020-01-01T10:31 (coercion at minute precision)', () => {
        const dt = createDateTime(2020, 1, 1, 10, 30);
        const result = dt.add(createTimeQuantity(90, 'second'));
        expect(result.toString()).toBe('2020-01-01T10:31');
      });

      it('@2020-01-01T10:30:00 + 90 seconds = @2020-01-01T10:31:30 (no coercion)', () => {
        const dt = createDateTime(2020, 1, 1, 10, 30, 0);
        const result = dt.add(createTimeQuantity(90, 'second'));
        expect(result.toString()).toBe('2020-01-01T10:31:30');
      });

      it('@2020-01-01T00:00:00 - 1 second = @2019-12-31T23:59:59', () => {
        const dt = createDateTime(2020, 1, 1, 0, 0, 0);
        const result = dt.subtract(createTimeQuantity(1, 'second'));
        expect(result.toString()).toBe('2019-12-31T23:59:59');
      });
    });

    describe('DateTime with Timezone', () => {
      it('@2020-01-01T10:30:00Z + 14 hours = @2020-01-02T00:30:00Z', () => {
        const dt = createDateTime(2020, 1, 1, 10, 30, 0, 0, 0); // UTC
        const result = dt.add(createTimeQuantity(14, 'hour'));
        expect(result.toString()).toBe('2020-01-02T00:30:00Z');
        expect(result.timezoneOffset).toBe(0);
      });

      it('@2020-01-01T10:30:00-05:00 + 1 day = @2020-01-02T10:30:00-05:00', () => {
        const dt = createDateTime(2020, 1, 1, 10, 30, 0, 0, -300); // EST
        const result = dt.add(createTimeQuantity(1, 'day'));
        expect(result.toString()).toBe('2020-01-02T10:30:00-05:00');
        expect(result.timezoneOffset).toBe(-300);
      });
    });
  });

  describe('Precision Preservation', () => {
    it('Adding should never expand precision', () => {
      const yearDate = createDate(2020);
      const monthResult = yearDate.add(createTimeQuantity(6, 'month'));
      expect(monthResult.precision.level).toBe('year'); // Not 'month'
      
      const monthDate = createDate(2020, 6);
      const dayResult = monthDate.add(createTimeQuantity(15, 'day'));
      expect(dayResult.precision.level).toBe('month'); // Not 'day'
      
      const hourTime = createTime(10);
      const minuteResult = hourTime.add(createTimeQuantity(30, 'minute'));
      expect(minuteResult.precision.level).toBe('hour'); // Not 'minute'
    });

    it('Subtracting should never expand precision', () => {
      const yearDate = createDate(2020);
      const result = yearDate.subtract(createTimeQuantity(3, 'month'));
      expect(result.precision.level).toBe('year');
    });
  });

  describe('Edge Cases and Boundaries', () => {
    it('Should handle year boundaries', () => {
      const date = createDate(1, 1, 1);
      const result = date.subtract(createTimeQuantity(1, 'day'));
      // This would go before year 1, which is invalid
      expect(result.year).toBeGreaterThan(0);
    });

    it('Should handle maximum year', () => {
      const date = createDate(9999, 12, 31);
      const result = date.add(createTimeQuantity(1, 'day'));
      // Should not overflow past 9999
      expect(result.year).toBeLessThanOrEqual(9999);
    });
  });
});