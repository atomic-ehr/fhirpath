import { describe, it, expect } from 'bun:test';
import {
  createDate,
  createDateTime,
  createTime,
  getDateLowBoundary,
  getDateHighBoundary,
  getDateTimeLowBoundary,
  getDateTimeHighBoundary,
  getTimeLowBoundary,
  getTimeHighBoundary
} from '../src/temporal';

describe('Temporal Boundary Functions', () => {
  describe('Date boundaries', () => {
    it('should calculate low boundary for year-only date with default precision', () => {
      const date = createDate(2014);
      const result = getDateLowBoundary(date);
      expect(result).toEqual(createDate(2014, 1, 1));
    });
    
    it('should calculate low boundary for year-only date with month precision', () => {
      const date = createDate(2014);
      const result = getDateLowBoundary(date, 6);
      expect(result).toEqual(createDate(2014, 1));
    });
    
    it('should calculate low boundary for year-month date with day precision', () => {
      const date = createDate(2014, 3);
      const result = getDateLowBoundary(date, 8);
      expect(result).toEqual(createDate(2014, 3, 1));
    });
    
    it('should calculate high boundary for year-only date with default precision', () => {
      const date = createDate(2014);
      const result = getDateHighBoundary(date);
      expect(result).toEqual(createDate(2014, 12, 31));
    });
    
    it('should calculate high boundary for year-only date with month precision', () => {
      const date = createDate(2014);
      const result = getDateHighBoundary(date, 6);
      expect(result).toEqual(createDate(2014, 12));
    });
    
    it('should calculate high boundary for year-month date', () => {
      const date = createDate(2014, 3);
      const result = getDateHighBoundary(date, 8);
      expect(result).toEqual(createDate(2014, 3, 31));
    });
    
    // Test leap year handling for February
    it('should handle leap years for high boundary', () => {
      const leapDate = createDate(2020, 2); // February 2020 (leap year)
      const result = getDateHighBoundary(leapDate, 8);
      expect(result?.day).toBe(29);
      
      const nonLeapDate = createDate(2021, 2); // February 2021 (non-leap)
      const result2 = getDateHighBoundary(nonLeapDate, 8);
      expect(result2?.day).toBe(28);
    });
    
    it('should handle 30-day months', () => {
      const april = createDate(2021, 4);
      const result = getDateHighBoundary(april, 8);
      expect(result?.day).toBe(30);
      
      const june = createDate(2021, 6);
      const result2 = getDateHighBoundary(june, 8);
      expect(result2?.day).toBe(30);
    });
    
    it('should return null for invalid precision', () => {
      const date = createDate(2014);
      expect(getDateLowBoundary(date, 9)).toBeNull(); // Date max is 8
      expect(getDateHighBoundary(date, 9)).toBeNull();
      expect(getDateLowBoundary(date, -1)).toBeNull();
      expect(getDateHighBoundary(date, -1)).toBeNull();
    });
  });
  
  describe('DateTime boundaries', () => {
    it('should calculate low boundary for DateTime with timezone', () => {
      const dt = createDateTime(2014, 1, 1, 8, undefined, undefined, undefined, -420); // -07:00
      
      // Default precision 17 (millisecond)
      const result = getDateTimeLowBoundary(dt);
      expect(result).toEqual(
        createDateTime(2014, 1, 1, 8, 0, 0, 0, -420) // Preserve existing timezone
      );
      
      // With minute precision (12)
      const result2 = getDateTimeLowBoundary(dt, 12);
      expect(result2).toEqual(
        createDateTime(2014, 1, 1, 8, 0, undefined, undefined, -420)
      );
    });
    
    it('should add timezone offset for DateTime without timezone at millisecond precision', () => {
      const dt = createDateTime(2014, 1, 1, 8);
      
      const low = getDateTimeLowBoundary(dt, 17);
      expect(low?.timezoneOffset).toBe(840); // +14:00
      expect(low?.minute).toBe(0);
      expect(low?.second).toBe(0);
      expect(low?.millisecond).toBe(0);
      
      const high = getDateTimeHighBoundary(dt, 17);
      expect(high?.timezoneOffset).toBe(-720); // -12:00
      expect(high?.minute).toBe(59);
      expect(high?.second).toBe(59);
      expect(high?.millisecond).toBe(999);
    });
    
    it('should not add timezone for lower precisions', () => {
      const dt = createDateTime(2014, 1, 1, 8);
      
      // Hour precision (10) - no timezone added
      const low = getDateTimeLowBoundary(dt, 10);
      expect(low?.timezoneOffset).toBeUndefined();
      
      const high = getDateTimeHighBoundary(dt, 10);
      expect(high?.timezoneOffset).toBeUndefined();
    });
    
    it('should calculate high boundary for DateTime with timezone', () => {
      const dt = createDateTime(2014, 1, 1, 8, 5, undefined, undefined, -300); // -05:00
      
      // Default precision 17 (millisecond)
      const result = getDateTimeHighBoundary(dt);
      expect(result).toEqual(
        createDateTime(2014, 1, 1, 8, 5, 59, 999, -300) // Preserve existing timezone
      );
    });
    
    it('should handle year-only DateTime', () => {
      const dt = createDateTime(2014);
      
      const low = getDateTimeLowBoundary(dt, 8);
      expect(low).toEqual(createDateTime(2014, 1, 1));
      
      const high = getDateTimeHighBoundary(dt, 8);
      expect(high).toEqual(createDateTime(2014, 12, 31));
    });
    
    it('should handle DateTime with partial time', () => {
      const dt = createDateTime(2014, 1, 1, 8, 30);
      
      const low = getDateTimeLowBoundary(dt, 14); // second precision
      expect(low).toEqual(createDateTime(2014, 1, 1, 8, 30, 0));
      
      const high = getDateTimeHighBoundary(dt, 14);
      expect(high).toEqual(createDateTime(2014, 1, 1, 8, 30, 59));
    });
    
    it('should return null for invalid precision', () => {
      const dt = createDateTime(2014);
      expect(getDateTimeLowBoundary(dt, 18)).toBeNull(); // DateTime max is 17
      expect(getDateTimeHighBoundary(dt, 18)).toBeNull();
      expect(getDateTimeLowBoundary(dt, -1)).toBeNull();
      expect(getDateTimeHighBoundary(dt, -1)).toBeNull();
    });
  });
  
  describe('Time boundaries', () => {
    it('should calculate boundaries for partial time', () => {
      const time = createTime(10, 30);
      
      // Low boundary with default precision (9)
      const low = getTimeLowBoundary(time);
      expect(low).toEqual(createTime(10, 30, 0, 0));
      
      // High boundary with default precision (9)
      const high = getTimeHighBoundary(time);
      expect(high).toEqual(createTime(10, 30, 59, 999));
    });
    
    it('should handle hour-only time', () => {
      const time = createTime(10);
      
      const low = getTimeLowBoundary(time, 5); // minute precision
      expect(low).toEqual(createTime(10, 0));
      
      const high = getTimeHighBoundary(time, 5);
      expect(high).toEqual(createTime(10, 59));
    });
    
    it('should handle second precision', () => {
      const time = createTime(10, 30);
      
      const low = getTimeLowBoundary(time, 7); // second precision
      expect(low).toEqual(createTime(10, 30, 0));
      
      const high = getTimeHighBoundary(time, 7);
      expect(high).toEqual(createTime(10, 30, 59));
    });
    
    it('should handle hour precision only', () => {
      const time = createTime(10);
      
      const low = getTimeLowBoundary(time, 4); // hour precision only
      expect(low).toEqual(createTime(10));
      
      const high = getTimeHighBoundary(time, 4);
      expect(high).toEqual(createTime(10));
    });
    
    it('should return null for invalid precision', () => {
      const time = createTime(10, 30);
      expect(getTimeLowBoundary(time, 10)).toBeNull(); // Time max is 9
      expect(getTimeHighBoundary(time, 10)).toBeNull();
      expect(getTimeLowBoundary(time, -1)).toBeNull();
      expect(getTimeHighBoundary(time, -1)).toBeNull();
    });
  });
  
  describe('Edge cases', () => {
    it('should handle December correctly', () => {
      const dec = createDate(2021, 12);
      const high = getDateHighBoundary(dec, 8);
      expect(high?.day).toBe(31);
    });
    
    it('should handle leap year edge cases', () => {
      // 2000 is a leap year (divisible by 400)
      const year2000 = createDate(2000, 2);
      const high2000 = getDateHighBoundary(year2000, 8);
      expect(high2000?.day).toBe(29);
      
      // 1900 is NOT a leap year (divisible by 100 but not 400)
      const year1900 = createDate(1900, 2);
      const high1900 = getDateHighBoundary(year1900, 8);
      expect(high1900?.day).toBe(28);
      
      // 2004 is a leap year (divisible by 4)
      const year2004 = createDate(2004, 2);
      const high2004 = getDateHighBoundary(year2004, 8);
      expect(high2004?.day).toBe(29);
    });
    
    it('should preserve complete dates/times', () => {
      const completeDate = createDate(2014, 5, 15);
      const lowDate = getDateLowBoundary(completeDate, 8);
      expect(lowDate).toEqual(completeDate);
      
      const highDate = getDateHighBoundary(completeDate, 8);
      expect(highDate).toEqual(completeDate);
      
      const completeTime = createTime(10, 30, 45, 123);
      const lowTime = getTimeLowBoundary(completeTime, 9);
      expect(lowTime).toEqual(completeTime);
      
      const highTime = getTimeHighBoundary(completeTime, 9);
      expect(highTime).toEqual(completeTime);
    });
  });
});