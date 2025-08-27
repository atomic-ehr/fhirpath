// FHIRPath Temporal Values Implementation
// Following ADR-017: Temporal Values Implementation

// ============================================================================
// Precision System
// ============================================================================

export interface PrecisionInfo {
  level: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond';
  value: number; // FHIRPath precision value
}

// FHIRPath precision values from spec
export const PRECISION_VALUES = {
  year: 4,
  month: 6,
  day: 8,
  hour: 10,
  minute: 12,
  second: 14,
  millisecond: 17,
} as const;

// For Date type (subset of full precision)
export const DATE_PRECISIONS = ['year', 'month', 'day'] as const;
export type DatePrecisionLevel = typeof DATE_PRECISIONS[number];

// For Time type (subset of full precision)  
export const TIME_PRECISIONS = ['hour', 'minute', 'second', 'millisecond'] as const;
export type TimePrecisionLevel = typeof TIME_PRECISIONS[number];

// For DateTime type (full set)
export type DateTimePrecisionLevel = PrecisionInfo['level'];

// ============================================================================
// Base Interfaces
// ============================================================================

export interface TemporalValue {
  readonly type: 'Date' | 'DateTime' | 'Time';
  readonly precision: PrecisionInfo;
  
  // Core comparison operations
  equals(other: TemporalValue): boolean | null;      // null for different precision
  equivalent(other: TemporalValue): boolean;         // false for different precision
  compare(other: TemporalValue): -1 | 0 | 1 | null; // null if incomparable
  
  // String representations
  toString(): string;                                // Human-readable, precision preserved
  toFHIRPathLiteral(): string;                      // With @ prefix
  
  // Precision utilities
  getPrecisionValue(): number;
}

// ============================================================================
// Time Quantity for Arithmetic
// ============================================================================

export type TimeUnit = 'year' | 'month' | 'week' | 'day' | 
                       'hour' | 'minute' | 'second' | 'millisecond';

export interface TimeQuantity {
  readonly value: number;
  readonly unit: TimeUnit;
  readonly isCalendarUnit: boolean;
}

export function createTimeQuantity(value: number, unit: TimeUnit): TimeQuantity {
  const calendarUnits = new Set(['year', 'month', 'week', 'day']);
  return {
    value,
    unit,
    isCalendarUnit: calendarUnits.has(unit)
  };
}

// ============================================================================
// FHIRDate Implementation
// ============================================================================

export class FHIRDate implements TemporalValue {
  readonly type = 'Date' as const;
  readonly precision: PrecisionInfo;
  readonly year: number;
  readonly month?: number;
  readonly day?: number;
  
  constructor(year: number, month?: number, day?: number) {
    this.year = year;
    this.month = month;
    this.day = day;
    
    // Validate constraints
    if (day !== undefined && month === undefined) {
      throw new Error('Month must be present if day is present');
    }
    
    // Validate ranges
    if (year < 1 || year > 9999) {
      throw new Error('Year must be between 0001 and 9999');
    }
    if (month !== undefined && (month < 1 || month > 12)) {
      throw new Error('Month must be between 1 and 12');
    }
    if (day !== undefined && (day < 1 || day > 31)) {
      throw new Error('Day must be between 1 and 31');
    }
    
    // Determine precision based on which components are present
    let level: DatePrecisionLevel;
    if (day !== undefined) {
      level = 'day';
    } else if (month !== undefined) {
      level = 'month';
    } else {
      level = 'year';
    }
    
    this.precision = {
      level,
      value: PRECISION_VALUES[level]
    };
  }
  
  equals(other: TemporalValue): boolean | null {
    if (other.type !== 'Date') return false;
    
    const otherDate = other as FHIRDate;
    
    // Compare year (always present)
    if (this.year !== otherDate.year) return false;
    
    // Check month precision
    const thisHasMonth = this.month !== undefined;
    const otherHasMonth = otherDate.month !== undefined;
    
    if (thisHasMonth && otherHasMonth) {
      // Both have month, compare values
      if (this.month !== otherDate.month) return false;
    } else if (thisHasMonth !== otherHasMonth) {
      // One has month, other doesn't - different precision
      return null;
    }
    
    // Check day precision
    const thisHasDay = this.day !== undefined;
    const otherHasDay = otherDate.day !== undefined;
    
    if (thisHasDay && otherHasDay) {
      // Both have day, compare values
      if (this.day !== otherDate.day) return false;
    } else if (thisHasDay !== otherHasDay) {
      // One has day, other doesn't - different precision
      return null;
    }
    
    return true;
  }
  
  equivalent(other: TemporalValue): boolean {
    if (other.type !== 'Date') return false;
    if (this.precision.value !== other.precision.value) return false;
    
    const otherDate = other as FHIRDate;
    return this.year === otherDate.year &&
           this.month === otherDate.month &&
           this.day === otherDate.day;
  }
  
  compare(other: TemporalValue): -1 | 0 | 1 | null {
    if (other.type !== 'Date') return null;
    const otherDate = other as FHIRDate;
    
    // Compare year
    if (this.year < otherDate.year) return -1;
    if (this.year > otherDate.year) return 1;
    
    // Compare month if both have it
    if (this.month !== undefined && otherDate.month !== undefined) {
      if (this.month < otherDate.month) return -1;
      if (this.month > otherDate.month) return 1;
    } else if (this.month !== otherDate.month) {
      return null; // Different precision at this level
    }
    
    // Compare day if both have it
    if (this.day !== undefined && otherDate.day !== undefined) {
      if (this.day < otherDate.day) return -1;
      if (this.day > otherDate.day) return 1;
    } else if (this.day !== otherDate.day) {
      return null; // Different precision at this level
    }
    
    return 0;
  }
  
  toString(): string {
    // Format year with 4-digit padding for years 0001-0999
    const yearStr = this.year >= 0 && this.year < 10000 ? 
      String(this.year).padStart(4, '0') : 
      String(this.year);
    
    if (this.precision.level === 'year') {
      return yearStr;
    } else if (this.precision.level === 'month') {
      return `${yearStr}-${String(this.month).padStart(2, '0')}`;
    } else {
      return `${yearStr}-${String(this.month).padStart(2, '0')}-${String(this.day).padStart(2, '0')}`;
    }
  }
  
  toFHIRPathLiteral(): string {
    return `@${this.toString()}`;
  }
  
  getPrecisionValue(): number {
    return this.precision.value;
  }
  
  add(quantity: TimeQuantity): FHIRDate {
    const { addToDate } = require('./temporal-arithmetic');
    return addToDate(this, quantity);
  }
  
  subtract(quantity: TimeQuantity): FHIRDate {
    const { subtractFromDate } = require('./temporal-arithmetic');
    return subtractFromDate(this, quantity);
  }
  
  // Component extraction
  yearOf(): number {
    return this.year;
  }
  
  monthOf(): number | null {
    return this.month ?? null;
  }
  
  dayOf(): number | null {
    return this.day ?? null;
  }
}

// ============================================================================
// FHIRTime Implementation
// ============================================================================

export class FHIRTime implements TemporalValue {
  readonly type = 'Time' as const;
  readonly precision: PrecisionInfo;
  readonly hour: number;
  readonly minute?: number;
  readonly second?: number;
  readonly millisecond?: number;
  
  constructor(hour: number, minute?: number, second?: number, millisecond?: number) {
    this.hour = hour;
    this.minute = minute;
    this.second = second;
    this.millisecond = millisecond;
    
    // Validate constraints
    if (second !== undefined && minute === undefined) {
      throw new Error('Minute must be present if second is present');
    }
    if (millisecond !== undefined && second === undefined) {
      throw new Error('Second must be present if millisecond is present');
    }
    
    // Validate ranges
    if (hour < 0 || hour > 23) {
      throw new Error('Hour must be between 0 and 23');
    }
    if (minute !== undefined && (minute < 0 || minute > 59)) {
      throw new Error('Minute must be between 0 and 59');
    }
    if (second !== undefined && (second < 0 || second > 59)) {
      throw new Error('Second must be between 0 and 59');
    }
    if (millisecond !== undefined && (millisecond < 0 || millisecond > 999)) {
      throw new Error('Millisecond must be between 0 and 999');
    }
    
    // Determine precision
    let level: TimePrecisionLevel;
    if (millisecond !== undefined) {
      level = 'millisecond';
    } else if (second !== undefined) {
      level = 'second';
    } else if (minute !== undefined) {
      level = 'minute';
    } else {
      level = 'hour';
    }
    
    // Special case: Time precision values are different
    const timePrecisionValues: Record<TimePrecisionLevel, number> = {
      hour: 4,
      minute: 6,
      second: 9,  // Note: not 14 like DateTime
      millisecond: 9  // Same as second for Time
    };
    
    this.precision = {
      level,
      value: timePrecisionValues[level]
    };
  }
  
  equals(other: TemporalValue): boolean | null {
    if (other.type !== 'Time') return false;
    
    const otherTime = other as FHIRTime;
    
    // Special handling for second/millisecond (same precision value)
    const thisHasSubsecond = this.precision.level === 'second' || this.precision.level === 'millisecond';
    const otherHasSubsecond = otherTime.precision.level === 'second' || otherTime.precision.level === 'millisecond';
    
    if (thisHasSubsecond !== otherHasSubsecond) return null;
    if (!thisHasSubsecond && this.precision.value !== otherTime.precision.value) return null;
    
    // When comparing times with second/millisecond precision, treat undefined milliseconds as 0
    const thisMs = this.millisecond ?? 0;
    const otherMs = otherTime.millisecond ?? 0;
    
    return this.hour === otherTime.hour &&
           this.minute === otherTime.minute &&
           this.second === otherTime.second &&
           thisMs === otherMs;
  }
  
  equivalent(other: TemporalValue): boolean {
    if (other.type !== 'Time') return false;
    
    const otherTime = other as FHIRTime;
    
    // Special handling for second/millisecond
    const thisHasSubsecond = this.precision.level === 'second' || this.precision.level === 'millisecond';
    const otherHasSubsecond = otherTime.precision.level === 'second' || otherTime.precision.level === 'millisecond';
    
    if (thisHasSubsecond !== otherHasSubsecond) return false;
    if (!thisHasSubsecond && this.precision.value !== otherTime.precision.value) return false;
    
    // When comparing times with second/millisecond precision, treat undefined milliseconds as 0
    const thisMs = this.millisecond ?? 0;
    const otherMs = otherTime.millisecond ?? 0;
    
    return this.hour === otherTime.hour &&
           this.minute === otherTime.minute &&
           this.second === otherTime.second &&
           thisMs === otherMs;
  }
  
  compare(other: TemporalValue): -1 | 0 | 1 | null {
    if (other.type !== 'Time') return null;
    const otherTime = other as FHIRTime;
    
    // Compare hour
    if (this.hour < otherTime.hour) return -1;
    if (this.hour > otherTime.hour) return 1;
    
    // Compare minute if both have it
    if (this.minute !== undefined && otherTime.minute !== undefined) {
      if (this.minute < otherTime.minute) return -1;
      if (this.minute > otherTime.minute) return 1;
    } else if (this.minute !== otherTime.minute) {
      return null;
    }
    
    // Compare second if both have it
    if (this.second !== undefined && otherTime.second !== undefined) {
      if (this.second < otherTime.second) return -1;
      if (this.second > otherTime.second) return 1;
    } else if (this.second !== otherTime.second) {
      return null;
    }
    
    // Compare millisecond if both have second-level precision
    // Treat undefined milliseconds as 0 when both have second/millisecond precision
    if ((this.precision.level === 'second' || this.precision.level === 'millisecond') &&
        (otherTime.precision.level === 'second' || otherTime.precision.level === 'millisecond')) {
      const thisMs = this.millisecond ?? 0;
      const otherMs = otherTime.millisecond ?? 0;
      if (thisMs < otherMs) return -1;
      if (thisMs > otherMs) return 1;
    }
    
    return 0;
  }
  
  toString(): string {
    let result = String(this.hour).padStart(2, '0');
    
    if (this.minute !== undefined) {
      result += ':' + String(this.minute).padStart(2, '0');
      
      if (this.second !== undefined) {
        result += ':' + String(this.second).padStart(2, '0');
        
        if (this.millisecond !== undefined) {
          result += '.' + String(this.millisecond).padStart(3, '0');
        }
      }
    }
    
    return result;
  }
  
  toFHIRPathLiteral(): string {
    return `@T${this.toString()}`;
  }
  
  getPrecisionValue(): number {
    return this.precision.value;
  }
  
  add(quantity: TimeQuantity): FHIRTime {
    const { addToTime } = require('./temporal-arithmetic');
    return addToTime(this, quantity);
  }
  
  subtract(quantity: TimeQuantity): FHIRTime {
    const { subtractFromTime } = require('./temporal-arithmetic');
    return subtractFromTime(this, quantity);
  }
  
  // Component extraction
  hourOf(): number {
    return this.hour;
  }
  
  minuteOf(): number | null {
    return this.minute ?? null;
  }
  
  secondOf(): number | null {
    return this.second ?? null;
  }
  
  millisecondOf(): number | null {
    return this.millisecond ?? null;
  }
}

// ============================================================================
// FHIRDateTime Implementation
// ============================================================================

export class FHIRDateTime implements TemporalValue {
  readonly type = 'DateTime' as const;
  readonly precision: PrecisionInfo;
  readonly year: number;
  readonly month?: number;
  readonly day?: number;
  readonly hour?: number;
  readonly minute?: number;
  readonly second?: number;
  readonly millisecond?: number;
  readonly timezoneOffset?: number; // Minutes from UTC, undefined = naive
  
  constructor(
    year: number,
    month?: number,
    day?: number,
    hour?: number,
    minute?: number,
    second?: number,
    millisecond?: number,
    timezoneOffset?: number
  ) {
    this.year = year;
    this.month = month;
    this.day = day;
    this.hour = hour;
    this.minute = minute;
    this.second = second;
    this.millisecond = millisecond;
    this.timezoneOffset = timezoneOffset;
    
    // Validate constraints
    if (day !== undefined && month === undefined) {
      throw new Error('Month must be present if day is present');
    }
    if (hour !== undefined && day === undefined) {
      throw new Error('Day must be present if hour is present');
    }
    if (minute !== undefined && hour === undefined) {
      throw new Error('Hour must be present if minute is present');
    }
    if (second !== undefined && minute === undefined) {
      throw new Error('Minute must be present if second is present');
    }
    if (millisecond !== undefined && second === undefined) {
      throw new Error('Second must be present if millisecond is present');
    }
    
    // Validate ranges
    if (year < 1 || year > 9999) {
      throw new Error('Year must be between 0001 and 9999');
    }
    if (month !== undefined && (month < 1 || month > 12)) {
      throw new Error('Month must be between 1 and 12');
    }
    if (day !== undefined && (day < 1 || day > 31)) {
      throw new Error('Day must be between 1 and 31');
    }
    if (hour !== undefined && (hour < 0 || hour > 23)) {
      throw new Error('Hour must be between 0 and 23');
    }
    if (minute !== undefined && (minute < 0 || minute > 59)) {
      throw new Error('Minute must be between 0 and 59');
    }
    if (second !== undefined && (second < 0 || second > 59)) {
      throw new Error('Second must be between 0 and 59');
    }
    if (millisecond !== undefined && (millisecond < 0 || millisecond > 999)) {
      throw new Error('Millisecond must be between 0 and 999');
    }
    
    // Determine precision
    let level: DateTimePrecisionLevel;
    if (millisecond !== undefined) {
      level = 'millisecond';
    } else if (second !== undefined) {
      level = 'second';
    } else if (minute !== undefined) {
      level = 'minute';
    } else if (hour !== undefined) {
      level = 'hour';
    } else if (day !== undefined) {
      level = 'day';
    } else if (month !== undefined) {
      level = 'month';
    } else {
      level = 'year';
    }
    
    this.precision = {
      level,
      value: PRECISION_VALUES[level]
    };
  }
  
  equals(other: TemporalValue): boolean | null {
    if (other.type !== 'DateTime') return false;
    
    const otherDateTime = other as FHIRDateTime;
    
    // Check timezone compatibility
    const bothNaive = this.timezoneOffset === undefined && otherDateTime.timezoneOffset === undefined;
    const bothAware = this.timezoneOffset !== undefined && otherDateTime.timezoneOffset !== undefined;
    if (!bothNaive && !bothAware) return null;
    
    // For timezone-aware comparisons, convert to UTC if needed
    const thisToCompare = bothAware && this.timezoneOffset !== otherDateTime.timezoneOffset ? this.toUTC() : this;
    const otherToCompare = bothAware && this.timezoneOffset !== otherDateTime.timezoneOffset ? otherDateTime.toUTC() : otherDateTime;
    
    // Compare year (always present)
    if (thisToCompare.year !== otherToCompare.year) return false;
    
    // Check month precision
    const thisHasMonth = thisToCompare.month !== undefined;
    const otherHasMonth = otherToCompare.month !== undefined;
    
    if (thisHasMonth && otherHasMonth) {
      if (thisToCompare.month !== otherToCompare.month) return false;
    } else if (thisHasMonth !== otherHasMonth) {
      return null;
    }
    
    // Check day precision
    const thisHasDay = thisToCompare.day !== undefined;
    const otherHasDay = otherToCompare.day !== undefined;
    
    if (thisHasDay && otherHasDay) {
      if (thisToCompare.day !== otherToCompare.day) return false;
    } else if (thisHasDay !== otherHasDay) {
      return null;
    }
    
    // Check hour precision
    const thisHasHour = thisToCompare.hour !== undefined;
    const otherHasHour = otherToCompare.hour !== undefined;
    
    if (thisHasHour && otherHasHour) {
      if (thisToCompare.hour !== otherToCompare.hour) return false;
    } else if (thisHasHour !== otherHasHour) {
      return null;
    }
    
    // Check minute precision
    const thisHasMinute = thisToCompare.minute !== undefined;
    const otherHasMinute = otherToCompare.minute !== undefined;
    
    if (thisHasMinute && otherHasMinute) {
      if (thisToCompare.minute !== otherToCompare.minute) return false;
    } else if (thisHasMinute !== otherHasMinute) {
      return null;
    }
    
    // Check second/millisecond precision (treated as one level per spec)
    const thisHasSecond = thisToCompare.second !== undefined;
    const otherHasSecond = otherToCompare.second !== undefined;
    
    if (thisHasSecond && otherHasSecond) {
      // For seconds and milliseconds, use decimal comparison semantics
      const thisMs = thisToCompare.millisecond ?? 0;
      const otherMs = otherToCompare.millisecond ?? 0;
      if (thisToCompare.second !== otherToCompare.second || thisMs !== otherMs) return false;
    } else if (thisHasSecond !== otherHasSecond) {
      return null;
    }
    
    return true;
  }
  
  equivalent(other: TemporalValue): boolean {
    if (other.type !== 'DateTime') return false;
    
    const otherDateTime = other as FHIRDateTime;
    
    // Check timezone compatibility
    const bothNaive = this.timezoneOffset === undefined && otherDateTime.timezoneOffset === undefined;
    const bothAware = this.timezoneOffset !== undefined && otherDateTime.timezoneOffset !== undefined;
    if (!bothNaive && !bothAware) return false;
    
    // Special handling for second/millisecond precision
    const thisSecondLevel = this.precision.level === 'second' || this.precision.level === 'millisecond';
    const otherSecondLevel = otherDateTime.precision.level === 'second' || otherDateTime.precision.level === 'millisecond';
    
    if (thisSecondLevel && otherSecondLevel) {
      // Both have second-level precision, can compare
    } else if (this.precision.value !== otherDateTime.precision.value) {
      return false;
    }
    
    // For timezone-aware comparisons, convert to UTC
    if (bothAware && this.timezoneOffset !== otherDateTime.timezoneOffset) {
      const thisUTC = this.toUTC();
      const otherUTC = otherDateTime.toUTC();
      return thisUTC.year === otherUTC.year &&
             thisUTC.month === otherUTC.month &&
             thisUTC.day === otherUTC.day &&
             thisUTC.hour === otherUTC.hour &&
             thisUTC.minute === otherUTC.minute &&
             thisUTC.second === otherUTC.second &&
             thisUTC.millisecond === otherUTC.millisecond;
    }
    
    return this.year === otherDateTime.year &&
           this.month === otherDateTime.month &&
           this.day === otherDateTime.day &&
           this.hour === otherDateTime.hour &&
           this.minute === otherDateTime.minute &&
           this.second === otherDateTime.second &&
           this.millisecond === otherDateTime.millisecond &&
           this.timezoneOffset === otherDateTime.timezoneOffset;
  }
  
  compare(other: TemporalValue): -1 | 0 | 1 | null {
    if (other.type !== 'DateTime') return null;
    const otherDateTime = other as FHIRDateTime;
    
    // Check timezone compatibility
    const bothNaive = this.timezoneOffset === undefined && otherDateTime.timezoneOffset === undefined;
    const bothAware = this.timezoneOffset !== undefined && otherDateTime.timezoneOffset !== undefined;
    if (!bothNaive && !bothAware) return null;
    
    // For timezone-aware comparisons, convert to UTC
    let thisToCompare: FHIRDateTime = this;
    let otherToCompare: FHIRDateTime = otherDateTime;
    
    if (bothAware && this.timezoneOffset !== otherDateTime.timezoneOffset) {
      thisToCompare = this.toUTC();
      otherToCompare = otherDateTime.toUTC();
    }
    
    // Compare year
    if (thisToCompare.year < otherToCompare.year) return -1;
    if (thisToCompare.year > otherToCompare.year) return 1;
    
    // Compare month if both have it
    if (thisToCompare.month !== undefined && otherToCompare.month !== undefined) {
      if (thisToCompare.month < otherToCompare.month) return -1;
      if (thisToCompare.month > otherToCompare.month) return 1;
    } else if (thisToCompare.month !== otherToCompare.month) {
      return null;
    }
    
    // Compare day if both have it
    if (thisToCompare.day !== undefined && otherToCompare.day !== undefined) {
      if (thisToCompare.day < otherToCompare.day) return -1;
      if (thisToCompare.day > otherToCompare.day) return 1;
    } else if (thisToCompare.day !== otherToCompare.day) {
      return null;
    }
    
    // Compare hour if both have it
    if (thisToCompare.hour !== undefined && otherToCompare.hour !== undefined) {
      if (thisToCompare.hour < otherToCompare.hour) return -1;
      if (thisToCompare.hour > otherToCompare.hour) return 1;
    } else if (thisToCompare.hour !== otherToCompare.hour) {
      return null;
    }
    
    // Compare minute if both have it
    if (thisToCompare.minute !== undefined && otherToCompare.minute !== undefined) {
      if (thisToCompare.minute < otherToCompare.minute) return -1;
      if (thisToCompare.minute > otherToCompare.minute) return 1;
    } else if (thisToCompare.minute !== otherToCompare.minute) {
      return null;
    }
    
    // Compare second if both have it
    if (thisToCompare.second !== undefined && otherToCompare.second !== undefined) {
      if (thisToCompare.second < otherToCompare.second) return -1;
      if (thisToCompare.second > otherToCompare.second) return 1;
    } else if (thisToCompare.second !== otherToCompare.second) {
      return null;
    }
    
    // Compare millisecond if both have it
    if (thisToCompare.millisecond !== undefined && otherToCompare.millisecond !== undefined) {
      if (thisToCompare.millisecond < otherToCompare.millisecond) return -1;
      if (thisToCompare.millisecond > otherToCompare.millisecond) return 1;
    } else if (thisToCompare.millisecond !== otherToCompare.millisecond) {
      return null;
    }
    
    return 0;
  }
  
  toString(): string {
    // Format year with 4-digit padding for years 0001-0999
    let result = this.year >= 0 && this.year < 10000 ? 
      String(this.year).padStart(4, '0') : 
      String(this.year);
    
    if (this.month !== undefined) {
      result += '-' + String(this.month).padStart(2, '0');
      
      if (this.day !== undefined) {
        result += '-' + String(this.day).padStart(2, '0');
        
        if (this.hour !== undefined) {
          result += 'T' + String(this.hour).padStart(2, '0');
          
          if (this.minute !== undefined) {
            result += ':' + String(this.minute).padStart(2, '0');
            
            if (this.second !== undefined) {
              result += ':' + String(this.second).padStart(2, '0');
              
              if (this.millisecond !== undefined) {
                result += '.' + String(this.millisecond).padStart(3, '0');
              }
            }
          }
          
          // Add timezone if present
          if (this.timezoneOffset !== undefined) {
            if (this.timezoneOffset === 0) {
              result += 'Z';
            } else {
              const sign = this.timezoneOffset > 0 ? '+' : '-';
              const absOffset = Math.abs(this.timezoneOffset);
              const hours = Math.floor(absOffset / 60);
              const minutes = absOffset % 60;
              result += sign + String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
            }
          }
        }
      }
    }
    
    // Special case: partial DateTime with T suffix
    if (this.hour === undefined && this.day === undefined) {
      result += 'T';
    }
    
    return result;
  }
  
  toFHIRPathLiteral(): string {
    return `@${this.toString()}`;
  }
  
  getPrecisionValue(): number {
    return this.precision.value;
  }
  
  add(quantity: TimeQuantity): FHIRDateTime {
    const { addToDateTime } = require('./temporal-arithmetic');
    return addToDateTime(this, quantity);
  }
  
  subtract(quantity: TimeQuantity): FHIRDateTime {
    const { subtractFromDateTime } = require('./temporal-arithmetic');
    return subtractFromDateTime(this, quantity);
  }
  
  // Component extraction
  yearOf(): number {
    return this.year;
  }
  
  monthOf(): number | null {
    return this.month ?? null;
  }
  
  dayOf(): number | null {
    return this.day ?? null;
  }
  
  hourOf(): number | null {
    return this.hour ?? null;
  }
  
  minuteOf(): number | null {
    return this.minute ?? null;
  }
  
  secondOf(): number | null {
    return this.second ?? null;
  }
  
  millisecondOf(): number | null {
    return this.millisecond ?? null;
  }
  
  timezoneOffsetOf(): number | null {
    return this.timezoneOffset ?? null;
  }
  
  // Conversions
  dateOf(): FHIRDate {
    return new FHIRDate(this.year, this.month, this.day);
  }
  
  timeOf(): FHIRTime | null {
    if (this.hour === undefined) return null;
    return new FHIRTime(this.hour, this.minute, this.second, this.millisecond);
  }
  
  // Convert to UTC for timezone-aware comparisons
  toUTC(): FHIRDateTime {
    if (this.timezoneOffset === undefined || this.timezoneOffset === 0) {
      return this;
    }
    
    // Only convert if we have time components
    if (this.hour === undefined) {
      return this;
    }
    
    // Create a date object to handle the conversion
    const jsDate = new Date(
      this.year,
      (this.month ?? 1) - 1,
      this.day ?? 1,
      this.hour ?? 0,
      this.minute ?? 0,
      this.second ?? 0,
      this.millisecond ?? 0
    );
    
    // Adjust for timezone offset (offset is in minutes)
    jsDate.setMinutes(jsDate.getMinutes() - this.timezoneOffset);
    
    // Extract UTC components
    return new FHIRDateTime(
      jsDate.getUTCFullYear(),
      this.month !== undefined ? jsDate.getUTCMonth() + 1 : undefined,
      this.day !== undefined ? jsDate.getUTCDate() : undefined,
      this.hour !== undefined ? jsDate.getUTCHours() : undefined,
      this.minute !== undefined ? jsDate.getUTCMinutes() : undefined,
      this.second !== undefined ? jsDate.getUTCSeconds() : undefined,
      this.millisecond !== undefined ? jsDate.getUTCMilliseconds() : undefined,
      0 // UTC timezone
    );
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createDate(year: number, month?: number, day?: number): FHIRDate {
  return new FHIRDate(year, month, day);
}

export function createDateTime(
  year: number,
  month?: number,
  day?: number,
  hour?: number,
  minute?: number,
  second?: number,
  millisecond?: number,
  timezoneOffset?: number
): FHIRDateTime {
  return new FHIRDateTime(year, month, day, hour, minute, second, millisecond, timezoneOffset);
}

export function createTime(
  hour: number,
  minute?: number,
  second?: number,
  millisecond?: number
): FHIRTime {
  return new FHIRTime(hour, minute, second, millisecond);
}

// ============================================================================
// Parser (Phase 2 - Basic implementation)
// ============================================================================

export function parseTemporalLiteral(literal: string): FHIRDate | FHIRDateTime | FHIRTime {
  if (!literal.startsWith('@')) {
    throw new Error('Temporal literal must start with @');
  }
  
  const value = literal.substring(1);
  
  // Time literal
  if (value.startsWith('T')) {
    const timePart = value.substring(1);
    const parts = timePart.split(/[:.]/)
    const hour = parseInt(parts[0] ?? '0', 10);
    const minute = parts[1] ? parseInt(parts[1], 10) : undefined;
    const second = parts[2] ? parseInt(parts[2], 10) : undefined;
    const millisecond = parts[3] ? parseInt(parts[3], 10) : undefined;
    
    // Validate parsed values
    if (isNaN(hour) || (minute !== undefined && isNaN(minute)) || 
        (second !== undefined && isNaN(second)) || (millisecond !== undefined && isNaN(millisecond))) {
      throw new Error(`Invalid time format: ${value}`);
    }
    
    return new FHIRTime(hour, minute, second, millisecond);
  }
  
  // Date or DateTime literal
  const hasT = value.includes('T');
  
  if (!hasT && !value.endsWith('T')) {
    // Pure Date
    const parts = value.split('-');
    const year = parseInt(parts[0] ?? '0', 10);
    const month = parts[1] ? parseInt(parts[1], 10) : undefined;
    const day = parts[2] ? parseInt(parts[2], 10) : undefined;
    
    // Validate parsed values
    if (isNaN(year) || (month !== undefined && isNaN(month)) || (day !== undefined && isNaN(day))) {
      throw new Error(`Invalid date format: ${value}`);
    }
    
    return new FHIRDate(year, month, day);
  } else {
    // DateTime
    let datePart: string;
    let timePart: string | undefined;
    let tzPart: string | undefined;
    
    if (value.endsWith('T')) {
      // Partial DateTime like @2014T
      datePart = value.slice(0, -1);
    } else {
      const tIndex = value.indexOf('T');
      datePart = value.substring(0, tIndex);
      let remaining = value.substring(tIndex + 1);
      
      // Check for timezone
      const tzMatch = remaining.match(/(Z|[+-]\d{2}:\d{2})$/);
      if (tzMatch) {
        tzPart = tzMatch[1]!;
        timePart = remaining.substring(0, remaining.length - tzPart.length);
      } else {
        timePart = remaining;
      }
    }
    
    // Parse date components
    const dateParts = datePart.split('-');
    const year = parseInt(dateParts[0] ?? '0', 10);
    const month = dateParts[1] ? parseInt(dateParts[1], 10) : undefined;
    const day = dateParts[2] ? parseInt(dateParts[2], 10) : undefined;
    
    // Validate date components
    if (isNaN(year) || (month !== undefined && isNaN(month)) || (day !== undefined && isNaN(day))) {
      throw new Error(`Invalid datetime format: ${value}`);
    }
    
    // Parse time components
    let hour: number | undefined;
    let minute: number | undefined;
    let second: number | undefined;
    let millisecond: number | undefined;
    
    if (timePart) {
      const timeParts = timePart.split(/[:.]/)
      hour = parseInt(timeParts[0] ?? '0', 10);
      minute = timeParts[1] ? parseInt(timeParts[1], 10) : undefined;
      second = timeParts[2] ? parseInt(timeParts[2], 10) : undefined;
      millisecond = timeParts[3] ? parseInt(timeParts[3], 10) : undefined;
      
      // Validate time components
      if ((hour !== undefined && isNaN(hour)) || (minute !== undefined && isNaN(minute)) || 
          (second !== undefined && isNaN(second)) || (millisecond !== undefined && isNaN(millisecond))) {
        throw new Error(`Invalid datetime format: ${value}`);
      }
    }
    
    // Parse timezone
    let timezoneOffset: number | undefined;
    if (tzPart) {
      if (tzPart === 'Z') {
        timezoneOffset = 0;
      } else {
        const sign = tzPart[0] === '+' ? 1 : -1;
        const tzParts = tzPart.substring(1).split(':');
        const hours = parseInt(tzParts[0] ?? '0', 10);
        const minutes = parseInt(tzParts[1] ?? '0', 10);
        timezoneOffset = sign * (hours * 60 + minutes);
      }
    }
    
    return new FHIRDateTime(year, month, day, hour, minute, second, millisecond, timezoneOffset);
  }
}

// ============================================================================
// Exports for backward compatibility (temporary)
// ============================================================================

export {
  FHIRDate as Date,
  FHIRDateTime as DateTime,
  FHIRTime as Time
};

// Legacy interfaces (to be removed)
export type { TemporalValue as TemporalPrecision };  // Temporary alias