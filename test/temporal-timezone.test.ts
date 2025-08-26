import { describe, it, expect } from 'bun:test';

import { createDateTime } from '../src/temporal';

describe('Temporal Timezone-Aware Comparisons', () => {
  
  describe('DateTime equals with timezones', () => {
    it('should compare UTC times correctly', () => {
      const dt1 = createDateTime(2020, 1, 1, 10, 30, 0, 0, 0); // UTC
      const dt2 = createDateTime(2020, 1, 1, 10, 30, 0, 0, 0); // UTC
      expect(dt1.equals(dt2)).toBe(true);
    });

    it('should compare different timezones by converting to UTC', () => {
      // 10:30 UTC = 05:30 EST (-5:00)
      const dtUTC = createDateTime(2020, 1, 1, 10, 30, 0, 0, 0); // UTC
      const dtEST = createDateTime(2020, 1, 1, 5, 30, 0, 0, -300); // EST (-5:00)
      expect(dtUTC.equals(dtEST)).toBe(true);
    });

    it('should return false for different times in different timezones', () => {
      const dt1 = createDateTime(2020, 1, 1, 10, 30, 0, 0, 0); // UTC
      const dt2 = createDateTime(2020, 1, 1, 10, 30, 0, 0, -300); // EST (different absolute time)
      expect(dt1.equals(dt2)).toBe(false);
    });

    it('should handle positive timezone offsets', () => {
      // 10:30 UTC = 16:00 IST (+5:30)
      const dtUTC = createDateTime(2020, 1, 1, 10, 30, 0, 0, 0); // UTC
      const dtIST = createDateTime(2020, 1, 1, 16, 0, 0, 0, 330); // IST (+5:30)
      expect(dtUTC.equals(dtIST)).toBe(true);
    });

    it('should handle date changes due to timezone conversion', () => {
      // 2020-01-01T00:30:00Z = 2019-12-31T19:30:00-05:00
      const dtUTC = createDateTime(2020, 1, 1, 0, 30, 0, 0, 0); // UTC
      const dtEST = createDateTime(2019, 12, 31, 19, 30, 0, 0, -300); // EST
      expect(dtUTC.equals(dtEST)).toBe(true);
    });
  });

  describe('DateTime equivalent with timezones', () => {
    it('should check structural equivalence with timezone conversion', () => {
      const dt1 = createDateTime(2020, 1, 1, 10, 30, 0, 0, 0); // UTC
      const dt2 = createDateTime(2020, 1, 1, 5, 30, 0, 0, -300); // EST
      expect(dt1.equivalent(dt2)).toBe(true);
    });

    it('should return false for different precision even with same time', () => {
      const dt1 = createDateTime(2020, 1, 1, 10, 30, 0, 0, 0); // second precision
      const dt2 = createDateTime(2020, 1, 1, 5, 30, 0, 0, -300); // EST, second precision
      expect(dt1.equivalent(dt2)).toBe(true);
      
      const dt3 = createDateTime(2020, 1, 1, 10, 30, 0, 0); // minute precision  
      const dt4 = createDateTime(2020, 1, 1, 5, 30, 0, 0, -300); // EST, second precision
      expect(dt3.equivalent(dt4)).toBe(false); // Different precision
    });

    it('should preserve timezone in equivalent check', () => {
      const dt1 = createDateTime(2020, 1, 1, 10, 30, 0, 0, 0); // UTC
      const dt2 = createDateTime(2020, 1, 1, 10, 30, 0, 0, 0); // UTC
      expect(dt1.equivalent(dt2)).toBe(true);
      expect(dt1.timezoneOffset === dt2.timezoneOffset).toBe(true);
    });
  });

  describe('DateTime compare with timezones', () => {
    it('should compare UTC times correctly', () => {
      const dt1 = createDateTime(2020, 1, 1, 10, 30, 0, 0, 0); // UTC
      const dt2 = createDateTime(2020, 1, 1, 11, 30, 0, 0, 0); // UTC
      expect(dt1.compare(dt2)).toBe(-1);
      expect(dt2.compare(dt1)).toBe(1);
    });

    it('should compare different timezones by converting to UTC', () => {
      // 10:30 UTC comes before 11:30 UTC (06:30 EST)
      const dt1 = createDateTime(2020, 1, 1, 10, 30, 0, 0, 0); // UTC
      const dt2 = createDateTime(2020, 1, 1, 6, 30, 0, 0, -300); // EST = 11:30 UTC
      expect(dt1.compare(dt2)).toBe(-1);
      expect(dt2.compare(dt1)).toBe(1);
    });

    it('should handle equal times in different timezones', () => {
      const dt1 = createDateTime(2020, 1, 1, 10, 30, 0, 0, 0); // UTC
      const dt2 = createDateTime(2020, 1, 1, 5, 30, 0, 0, -300); // EST = 10:30 UTC
      expect(dt1.compare(dt2)).toBe(0);
    });

    it('should compare across date boundaries', () => {
      // 2020-01-01T00:30:00Z vs 2019-12-31T23:30:00Z
      const dt1 = createDateTime(2020, 1, 1, 0, 30, 0, 0, 0); // UTC
      const dt2 = createDateTime(2019, 12, 31, 18, 30, 0, 0, -300); // EST = 23:30 UTC previous day
      expect(dt1.compare(dt2)).toBe(1);
      expect(dt2.compare(dt1)).toBe(-1);
    });

    it('should handle partial DateTime with timezone', () => {
      const dt1 = createDateTime(2020, 1, 1, 10, 0, 0, 0, 0); // UTC, no minutes specified -> minute precision
      const dt2 = createDateTime(2020, 1, 1, 5, 0, 0, 0, -300); // EST = 10:00 UTC, minute precision
      expect(dt1.compare(dt2)).toBe(0);
    });

    it('should return null for mixed naive/aware comparisons', () => {
      const dtNaive = createDateTime(2020, 1, 1, 10, 30, 0); // No timezone
      const dtAware = createDateTime(2020, 1, 1, 10, 30, 0, 0, 0); // UTC
      expect(dtNaive.compare(dtAware)).toBe(null);
      expect(dtAware.compare(dtNaive)).toBe(null);
    });
  });

  describe('Edge cases', () => {
    it('should handle midnight crossing with timezone conversion', () => {
      // Midnight UTC = 7pm EST previous day
      const dtUTC = createDateTime(2020, 1, 1, 0, 0, 0, 0, 0); // Midnight UTC
      const dtEST = createDateTime(2019, 12, 31, 19, 0, 0, 0, -300); // 7pm EST previous day
      expect(dtUTC.equals(dtEST)).toBe(true);
    });

    it('should handle year boundary with timezone conversion', () => {
      // New Year UTC = Still previous year in some timezones
      const dtUTC = createDateTime(2021, 1, 1, 3, 0, 0, 0, 0); // 3am UTC Jan 1
      const dtPST = createDateTime(2020, 12, 31, 19, 0, 0, 0, -480); // 7pm PST Dec 31
      expect(dtUTC.equals(dtPST)).toBe(true);
    });

    it('should preserve original timezone in non-conversion cases', () => {
      const dt1 = createDateTime(2020, 1, 1, 10, 30, 0, 0, 300); // +5:00
      const dt2 = createDateTime(2020, 1, 1, 10, 30, 0, 0, 300); // +5:00
      expect(dt1.equals(dt2)).toBe(true);
      expect(dt1.timezoneOffset).toBe(300);
      expect(dt2.timezoneOffset).toBe(300);
    });

    it('should handle partial DateTime without time components', () => {
      // DateTime without time components shouldn't be converted
      const dt1 = createDateTime(2020, 1, 1); // No time, no timezone
      const dt2 = createDateTime(2020, 1, 1); // No time, no timezone
      expect(dt1.equals(dt2)).toBe(true);
    });
  });
});