import { describe, it, expect } from 'bun:test';

import {
  FHIRDate,
  FHIRDateTime,
  FHIRTime,
  createDate,
  createDateTime,
  createTime,
  createTimeQuantity,
  parseTemporalLiteral,
  PRECISION_VALUES
} from '../src/temporal';

describe('Temporal Values Implementation', () => {
  
  describe('FHIRDate', () => {
    describe('constructor and precision', () => {
      it('should create date with year precision', () => {
        const date = createDate(2025);
        expect(date.year).toBe(2025);
        expect(date.month).toBeUndefined();
        expect(date.day).toBeUndefined();
        expect(date.precision.level).toBe('year');
        expect(date.precision.value).toBe(4);
      });

      it('should create date with month precision', () => {
        const date = createDate(2025, 3);
        expect(date.year).toBe(2025);
        expect(date.month).toBe(3);
        expect(date.day).toBeUndefined();
        expect(date.precision.level).toBe('month');
        expect(date.precision.value).toBe(6);
      });

      it('should create date with day precision', () => {
        const date = createDate(2025, 3, 15);
        expect(date.year).toBe(2025);
        expect(date.month).toBe(3);
        expect(date.day).toBe(15);
        expect(date.precision.level).toBe('day');
        expect(date.precision.value).toBe(8);
      });

      it('should throw if day present without month', () => {
        expect(() => new FHIRDate(2025, undefined, 15)).toThrow('Month must be present if day is present');
      });
    });

    describe('toString and toFHIRPathLiteral', () => {
      it('should preserve year precision in string', () => {
        const date = createDate(2025);
        expect(date.toString()).toBe('2025');
        expect(date.toFHIRPathLiteral()).toBe('@2025');
      });

      it('should preserve month precision in string', () => {
        const date = createDate(2025, 3);
        expect(date.toString()).toBe('2025-03');
        expect(date.toFHIRPathLiteral()).toBe('@2025-03');
      });

      it('should preserve day precision in string', () => {
        const date = createDate(2025, 3, 15);
        expect(date.toString()).toBe('2025-03-15');
        expect(date.toFHIRPathLiteral()).toBe('@2025-03-15');
      });
    });

    describe('equals', () => {
      it('should return true for same dates with same precision', () => {
        const date1 = createDate(2025, 3, 15);
        const date2 = createDate(2025, 3, 15);
        expect(date1.equals(date2)).toBe(true);
      });

      it('should return null for different precisions', () => {
        const date1 = createDate(2025, 3);
        const date2 = createDate(2025, 3, 15);
        expect(date1.equals(date2)).toBe(null);
      });

      it('should return false for different types', () => {
        const date = createDate(2025, 3, 15);
        const time = createTime(10, 30);
        expect(date.equals(time)).toBe(false);
      });
    });

    describe('equivalent', () => {
      it('should return false for different precisions', () => {
        const date1 = createDate(2025, 3);
        const date2 = createDate(2025, 3, 15);
        expect(date1.equivalent(date2)).toBe(false);
      });
    });

    describe('compare', () => {
      it('should compare dates with same precision', () => {
        const date1 = createDate(2025, 3, 14);
        const date2 = createDate(2025, 3, 15);
        const date3 = createDate(2025, 3, 15);
        
        expect(date1.compare(date2)).toBe(-1);
        expect(date2.compare(date1)).toBe(1);
        expect(date2.compare(date3)).toBe(0);
      });

      it('should return null for different precisions at comparison point', () => {
        const date1 = createDate(2025, 3);
        const date2 = createDate(2025, 3, 15);
        expect(date1.compare(date2)).toBe(null);
      });
    });

    describe('component extraction', () => {
      it('should extract components correctly', () => {
        const date = createDate(2025, 3, 15);
        expect(date.yearOf()).toBe(2025);
        expect(date.monthOf()).toBe(3);
        expect(date.dayOf()).toBe(15);
      });

      it('should return null for missing components', () => {
        const date = createDate(2025);
        expect(date.yearOf()).toBe(2025);
        expect(date.monthOf()).toBe(null);
        expect(date.dayOf()).toBe(null);
      });
    });
  });

  describe('FHIRTime', () => {
    describe('constructor and precision', () => {
      it('should create time with hour precision', () => {
        const time = createTime(10);
        expect(time.hour).toBe(10);
        expect(time.minute).toBeUndefined();
        expect(time.precision.level).toBe('hour');
        expect(time.precision.value).toBe(4); // Time has different precision values
      });

      it('should create time with minute precision', () => {
        const time = createTime(10, 30);
        expect(time.hour).toBe(10);
        expect(time.minute).toBe(30);
        expect(time.precision.level).toBe('minute');
        expect(time.precision.value).toBe(6);
      });

      it('should create time with second precision', () => {
        const time = createTime(10, 30, 45);
        expect(time.hour).toBe(10);
        expect(time.minute).toBe(30);
        expect(time.second).toBe(45);
        expect(time.precision.level).toBe('second');
        expect(time.precision.value).toBe(9); // Note: 9, not 14
      });

      it('should create time with millisecond precision', () => {
        const time = createTime(10, 30, 45, 500);
        expect(time.precision.level).toBe('millisecond');
        expect(time.precision.value).toBe(9); // Same as second for Time
      });
    });

    describe('toString and toFHIRPathLiteral', () => {
      it('should preserve hour precision in string', () => {
        const time = createTime(10);
        expect(time.toString()).toBe('10');
        expect(time.toFHIRPathLiteral()).toBe('@T10');
      });

      it('should preserve minute precision in string', () => {
        const time = createTime(10, 30);
        expect(time.toString()).toBe('10:30');
        expect(time.toFHIRPathLiteral()).toBe('@T10:30');
      });

      it('should preserve second precision in string', () => {
        const time = createTime(10, 30, 45);
        expect(time.toString()).toBe('10:30:45');
        expect(time.toFHIRPathLiteral()).toBe('@T10:30:45');
      });

      it('should preserve millisecond precision in string', () => {
        const time = createTime(10, 30, 45, 123);
        expect(time.toString()).toBe('10:30:45.123');
        expect(time.toFHIRPathLiteral()).toBe('@T10:30:45.123');
      });
    });

    describe('equals with second/millisecond special handling', () => {
      it('should treat second and millisecond as same precision level', () => {
        const time1 = createTime(10, 30, 45);
        const time2 = createTime(10, 30, 45, 0);
        expect(time1.equals(time2)).toBe(true);
      });

      it('should return null for different precision groups', () => {
        const time1 = createTime(10, 30);
        const time2 = createTime(10, 30, 0);
        expect(time1.equals(time2)).toBe(null);
      });
    });
  });

  describe('FHIRDateTime', () => {
    describe('constructor and precision', () => {
      it('should create partial DateTime with year precision', () => {
        const dt = createDateTime(2025);
        expect(dt.year).toBe(2025);
        expect(dt.precision.level).toBe('year');
        expect(dt.precision.value).toBe(4);
      });

      it('should create DateTime with full precision', () => {
        const dt = createDateTime(2025, 3, 15, 10, 30, 45, 123);
        expect(dt.year).toBe(2025);
        expect(dt.month).toBe(3);
        expect(dt.day).toBe(15);
        expect(dt.hour).toBe(10);
        expect(dt.minute).toBe(30);
        expect(dt.second).toBe(45);
        expect(dt.millisecond).toBe(123);
        expect(dt.precision.level).toBe('millisecond');
        expect(dt.precision.value).toBe(17);
      });

      it('should handle timezone offset', () => {
        const dt = createDateTime(2025, 3, 15, 10, 30, 0, 0, 0); // UTC
        expect(dt.timezoneOffset).toBe(0);
        
        const dt2 = createDateTime(2025, 3, 15, 10, 30, 0, 0, -300); // EST
        expect(dt2.timezoneOffset).toBe(-300);
      });
    });

    describe('toString with partial DateTime', () => {
      it('should add T suffix for partial DateTime without time components', () => {
        const dt1 = createDateTime(2025);
        expect(dt1.toString()).toBe('2025T');
        
        const dt2 = createDateTime(2025, 3);
        expect(dt2.toString()).toBe('2025-03T');
      });

      it('should not add T suffix when day is present', () => {
        const dt = createDateTime(2025, 3, 15);
        expect(dt.toString()).toBe('2025-03-15');
      });

      it('should format timezone correctly', () => {
        const dt1 = createDateTime(2025, 3, 15, 10, 30, 0, 0, 0);
        expect(dt1.toString()).toContain('Z');
        
        const dt2 = createDateTime(2025, 3, 15, 10, 30, 0, 0, 300);
        expect(dt2.toString()).toContain('+05:00');
        
        const dt3 = createDateTime(2025, 3, 15, 10, 30, 0, 0, -300);
        expect(dt3.toString()).toContain('-05:00');
      });
    });

    describe('conversions', () => {
      it('should extract Date from DateTime', () => {
        const dt = createDateTime(2025, 3, 15, 10, 30);
        const date = dt.dateOf();
        expect(date.year).toBe(2025);
        expect(date.month).toBe(3);
        expect(date.day).toBe(15);
        expect(date.precision.level).toBe('day');
      });

      it('should extract Time from DateTime', () => {
        const dt = createDateTime(2025, 3, 15, 10, 30, 45);
        const time = dt.timeOf();
        expect(time).not.toBe(null);
        expect(time!.hour).toBe(10);
        expect(time!.minute).toBe(30);
        expect(time!.second).toBe(45);
      });

      it('should return null Time for DateTime without time components', () => {
        const dt = createDateTime(2025, 3, 15);
        const time = dt.timeOf();
        expect(time).toBe(null);
      });
    });
  });

  describe('parseTemporalLiteral', () => {
    describe('Date parsing', () => {
      it('should parse year-only date', () => {
        const date = parseTemporalLiteral('@2025') as FHIRDate;
        expect(date.type).toBe('Date');
        expect(date.year).toBe(2025);
        expect(date.precision.level).toBe('year');
      });

      it('should parse year-month date', () => {
        const date = parseTemporalLiteral('@2025-03') as FHIRDate;
        expect(date.type).toBe('Date');
        expect(date.year).toBe(2025);
        expect(date.month).toBe(3);
        expect(date.precision.level).toBe('month');
      });

      it('should parse full date', () => {
        const date = parseTemporalLiteral('@2025-03-15') as FHIRDate;
        expect(date.type).toBe('Date');
        expect(date.year).toBe(2025);
        expect(date.month).toBe(3);
        expect(date.day).toBe(15);
        expect(date.precision.level).toBe('day');
      });
    });

    describe('Time parsing', () => {
      it('should parse hour-only time', () => {
        const time = parseTemporalLiteral('@T10') as FHIRTime;
        expect(time.type).toBe('Time');
        expect(time.hour).toBe(10);
        expect(time.precision.level).toBe('hour');
      });

      it('should parse time with minutes', () => {
        const time = parseTemporalLiteral('@T10:30') as FHIRTime;
        expect(time.type).toBe('Time');
        expect(time.hour).toBe(10);
        expect(time.minute).toBe(30);
        expect(time.precision.level).toBe('minute');
      });

      it('should parse time with seconds', () => {
        const time = parseTemporalLiteral('@T10:30:45') as FHIRTime;
        expect(time.type).toBe('Time');
        expect(time.second).toBe(45);
        expect(time.precision.level).toBe('second');
      });

      it('should parse time with milliseconds', () => {
        const time = parseTemporalLiteral('@T10:30:45.123') as FHIRTime;
        expect(time.type).toBe('Time');
        expect(time.millisecond).toBe(123);
        expect(time.precision.level).toBe('millisecond');
      });
    });

    describe('DateTime parsing', () => {
      it('should parse partial DateTime with T suffix', () => {
        const dt = parseTemporalLiteral('@2025T') as FHIRDateTime;
        expect(dt.type).toBe('DateTime');
        expect(dt.year).toBe(2025);
        expect(dt.precision.level).toBe('year');
      });

      it('should parse DateTime with date and time', () => {
        const dt = parseTemporalLiteral('@2025-03-15T10:30:45') as FHIRDateTime;
        expect(dt.type).toBe('DateTime');
        expect(dt.year).toBe(2025);
        expect(dt.month).toBe(3);
        expect(dt.day).toBe(15);
        expect(dt.hour).toBe(10);
        expect(dt.minute).toBe(30);
        expect(dt.second).toBe(45);
        expect(dt.precision.level).toBe('second');
      });

      it('should parse DateTime with UTC timezone', () => {
        const dt = parseTemporalLiteral('@2025-03-15T10:30:45Z') as FHIRDateTime;
        expect(dt.timezoneOffset).toBe(0);
      });

      it('should parse DateTime with positive offset', () => {
        const dt = parseTemporalLiteral('@2025-03-15T10:30:45+05:30') as FHIRDateTime;
        expect(dt.timezoneOffset).toBe(330); // 5*60 + 30
      });

      it('should parse DateTime with negative offset', () => {
        const dt = parseTemporalLiteral('@2025-03-15T10:30:45-08:00') as FHIRDateTime;
        expect(dt.timezoneOffset).toBe(-480); // -8*60
      });
    });

    it('should throw for invalid format', () => {
      expect(() => parseTemporalLiteral('2025')).toThrow('Temporal literal must start with @');
    });
  });

  describe('TimeQuantity', () => {
    it('should identify calendar units', () => {
      expect(createTimeQuantity(1, 'year').isCalendarUnit).toBe(true);
      expect(createTimeQuantity(1, 'month').isCalendarUnit).toBe(true);
      expect(createTimeQuantity(1, 'week').isCalendarUnit).toBe(true);
      expect(createTimeQuantity(1, 'day').isCalendarUnit).toBe(true);
      expect(createTimeQuantity(1, 'hour').isCalendarUnit).toBe(false);
      expect(createTimeQuantity(1, 'minute').isCalendarUnit).toBe(false);
      expect(createTimeQuantity(1, 'second').isCalendarUnit).toBe(false);
      expect(createTimeQuantity(1, 'millisecond').isCalendarUnit).toBe(false);
    });
  });

  describe('Arithmetic (Phase 3 complete)', () => {
    it('should add months to date', () => {
      const date = createDate(2025, 1, 1);
      const quantity = createTimeQuantity(1, 'month');
      const result = date.add(quantity);
      expect(result.toString()).toBe('2025-02-01');
    });

    it('should subtract months from date', () => {
      const date = createDate(2025, 1, 1);
      const quantity = createTimeQuantity(1, 'month');
      const result = date.subtract(quantity);
      expect(result.toString()).toBe('2024-12-01');
    });
  });
});