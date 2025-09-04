// FHIRPath Temporal Values - Functional Implementation
// Following ADR-019: Refactor from Classes to Functions and Interfaces
import { Errors } from '../errors';

// ============================================================================
// Precision System
// ============================================================================

export interface PrecisionInfo {
  level: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond';
  value: number;
}

export const PRECISION_VALUES = {
  year: 4,
  month: 6,
  day: 8,
  hour: 10,
  minute: 12,
  second: 14,
  millisecond: 17,
} as const;

export const DATE_PRECISIONS = ['year', 'month', 'day'] as const;
export type DatePrecisionLevel = typeof DATE_PRECISIONS[number];

export const TIME_PRECISIONS = ['hour', 'minute', 'second', 'millisecond'] as const;
export type TimePrecisionLevel = typeof TIME_PRECISIONS[number];

export type DateTimePrecisionLevel = PrecisionInfo['level'];

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
  const calendarUnits = new Set(['year', 'years', 'month', 'months', 'week', 'weeks', 'day', 'days']);
  return {
    value,
    unit,
    isCalendarUnit: calendarUnits.has(unit)
  };
}

// ============================================================================
// Discriminated Union Types with Interfaces
// ============================================================================

export interface FHIRDate {
  readonly kind: 'FHIRDate';
  readonly year: number;
  readonly month?: number;
  readonly day?: number;
  readonly precision: PrecisionInfo;
}

export interface FHIRTime {
  readonly kind: 'FHIRTime';
  readonly hour: number;
  readonly minute?: number;
  readonly second?: number;
  readonly millisecond?: number;
  readonly precision: PrecisionInfo;
}

export interface FHIRDateTime {
  readonly kind: 'FHIRDateTime';
  readonly year: number;
  readonly month?: number;
  readonly day?: number;
  readonly hour?: number;
  readonly minute?: number;
  readonly second?: number;
  readonly millisecond?: number;
  readonly timezoneOffset?: number;
  readonly precision: PrecisionInfo;
}

export type TemporalValue = FHIRDate | FHIRTime | FHIRDateTime;

// ============================================================================
// Type Guards
// ============================================================================

export function isFHIRDate(value: any): value is FHIRDate {
  return value && typeof value === 'object' && value.kind === 'FHIRDate';
}

export function isFHIRTime(value: any): value is FHIRTime {
  return value && typeof value === 'object' && value.kind === 'FHIRTime';
}

export function isFHIRDateTime(value: any): value is FHIRDateTime {
  return value && typeof value === 'object' && value.kind === 'FHIRDateTime';
}

export function isTemporalValue(value: any): value is TemporalValue {
  return isFHIRDate(value) || isFHIRTime(value) || isFHIRDateTime(value);
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createDate(year: number, month?: number, day?: number): FHIRDate {
  // Validation
  if (day !== undefined && month === undefined) {
    throw new Error('Month must be present if day is present');
  }
  
  if (year < 1 || year > 9999) {
    throw new Error('Year must be between 1 and 9999');
  }
  if (month !== undefined && (month < 1 || month > 12)) {
    throw new Error('Month must be between 1 and 12');
  }
  if (day !== undefined && (day < 1 || day > 31)) {
    throw new Error('Day must be between 1 and 31');
  }
  
  // Determine precision
  let level: DatePrecisionLevel;
  if (day !== undefined) {
    level = 'day';
  } else if (month !== undefined) {
    level = 'month';
  } else {
    level = 'year';
  }
  
  return {
    kind: 'FHIRDate',
    year,
    month,
    day,
    precision: {
      level,
      value: PRECISION_VALUES[level]
    }
  };
}

export function createTime(hour: number, minute?: number, second?: number, millisecond?: number): FHIRTime {
  // Validation
  if (second !== undefined && minute === undefined) {
    throw new Error('Minute must be present if second is present');
  }
  if (millisecond !== undefined && second === undefined) {
    throw new Error('Second must be present if millisecond is present');
  }
  
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
    second: 8,
    millisecond: 11
  };
  
  return {
    kind: 'FHIRTime',
    hour,
    minute,
    second,
    millisecond,
    precision: {
      level,
      value: timePrecisionValues[level]
    }
  };
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
  // Validation
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
  
  if (year < 1 || year > 9999) {
    throw new Error('Year must be between 1 and 9999');
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
  
  return {
    kind: 'FHIRDateTime',
    year,
    month,
    day,
    hour,
    minute,
    second,
    millisecond,
    timezoneOffset,
    precision: {
      level,
      value: PRECISION_VALUES[level]
    }
  };
}

// ============================================================================
// Comparison Operations
// ============================================================================

export function equals(a: TemporalValue, b: TemporalValue): boolean | null {
  // Different types are never equal
  if (a.kind !== b.kind) {
    return false;
  }
  
  if (isFHIRDate(a) && isFHIRDate(b)) {
    // Compare year (always present)
    if (a.year !== b.year) return false;
    
    // Compare month - if one has it and other doesn't, return null
    if (a.month !== undefined || b.month !== undefined) {
      if (a.month === undefined || b.month === undefined) return null;
      if (a.month !== b.month) return false;
    }
    
    // Compare day - if one has it and other doesn't, return null
    if (a.day !== undefined || b.day !== undefined) {
      if (a.day === undefined || b.day === undefined) return null;
      if (a.day !== b.day) return false;
    }
    
    return true;
  }
  
  if (isFHIRTime(a) && isFHIRTime(b)) {
    // Compare hour (always present)
    if (a.hour !== b.hour) return false;
    
    // Compare minute
    if (a.minute !== undefined || b.minute !== undefined) {
      if (a.minute === undefined || b.minute === undefined) return null;
      if (a.minute !== b.minute) return false;
    }
    
    // Compare second/millisecond as a single precision per spec
    if ((a.second !== undefined || a.millisecond !== undefined) ||
        (b.second !== undefined || b.millisecond !== undefined)) {
      const aHasSecondPrecision = a.second !== undefined || a.millisecond !== undefined;
      const bHasSecondPrecision = b.second !== undefined || b.millisecond !== undefined;

      if (!aHasSecondPrecision || !bHasSecondPrecision) return null;

      // Compare as integer milliseconds for exact decimal semantics
      const aMs = (a.second ?? 0) * 1000 + (a.millisecond ?? 0);
      const bMs = (b.second ?? 0) * 1000 + (b.millisecond ?? 0);
      if (aMs !== bMs) return false;
    }
    
    return true;
  }
  
  if (isFHIRDateTime(a) && isFHIRDateTime(b)) {
    // For DateTime with timezones, must normalize or both be naive
    if (a.timezoneOffset !== undefined && b.timezoneOffset !== undefined) {
      // Both have timezones - need to normalize to UTC for comparison
      const aUtc = normalizeToUTC(a);
      const bUtc = normalizeToUTC(b);
      
      // Compare year
      if (aUtc.year !== bUtc.year) return false;
      
      // Compare month
      if (aUtc.month !== undefined || bUtc.month !== undefined) {
        if (aUtc.month === undefined || bUtc.month === undefined) return null;
        if (aUtc.month !== bUtc.month) return false;
      }
      
      // Compare day
      if (aUtc.day !== undefined || bUtc.day !== undefined) {
        if (aUtc.day === undefined || bUtc.day === undefined) return null;
        if (aUtc.day !== bUtc.day) return false;
      }
      
      // Compare hour
      if (aUtc.hour !== undefined || bUtc.hour !== undefined) {
        if (aUtc.hour === undefined || bUtc.hour === undefined) return null;
        if (aUtc.hour !== bUtc.hour) return false;
      }
      
      // Compare minute
      if (aUtc.minute !== undefined || bUtc.minute !== undefined) {
        if (aUtc.minute === undefined || bUtc.minute === undefined) return null;
        if (aUtc.minute !== bUtc.minute) return false;
      }
      
      // Compare second/millisecond as single precision
      if ((aUtc.second !== undefined || aUtc.millisecond !== undefined) ||
          (bUtc.second !== undefined || bUtc.millisecond !== undefined)) {
        const aHasSecondPrecision = aUtc.second !== undefined || aUtc.millisecond !== undefined;
        const bHasSecondPrecision = bUtc.second !== undefined || bUtc.millisecond !== undefined;

        if (!aHasSecondPrecision || !bHasSecondPrecision) return null;

        const aMs = (aUtc.second ?? 0) * 1000 + (aUtc.millisecond ?? 0);
        const bMs = (bUtc.second ?? 0) * 1000 + (bUtc.millisecond ?? 0);
        if (aMs !== bMs) return false;
      }
      
      return true;
    } else if (a.timezoneOffset === undefined && b.timezoneOffset === undefined) {
      // Both naive - direct comparison
      // Compare year
      if (a.year !== b.year) return false;
      
      // Compare month
      if (a.month !== undefined || b.month !== undefined) {
        if (a.month === undefined || b.month === undefined) return null;
        if (a.month !== b.month) return false;
      }
      
      // Compare day
      if (a.day !== undefined || b.day !== undefined) {
        if (a.day === undefined || b.day === undefined) return null;
        if (a.day !== b.day) return false;
      }
      
      // Compare hour
      if (a.hour !== undefined || b.hour !== undefined) {
        if (a.hour === undefined || b.hour === undefined) return null;
        if (a.hour !== b.hour) return false;
      }
      
      // Compare minute
      if (a.minute !== undefined || b.minute !== undefined) {
        if (a.minute === undefined || b.minute === undefined) return null;
        if (a.minute !== b.minute) return false;
      }
      
      // Compare second/millisecond as single precision
      if ((a.second !== undefined || a.millisecond !== undefined) ||
          (b.second !== undefined || b.millisecond !== undefined)) {
        const aHasSecondPrecision = a.second !== undefined || a.millisecond !== undefined;
        const bHasSecondPrecision = b.second !== undefined || b.millisecond !== undefined;

        if (!aHasSecondPrecision || !bHasSecondPrecision) return null;

        const aMs = (a.second ?? 0) * 1000 + (a.millisecond ?? 0);
        const bMs = (b.second ?? 0) * 1000 + (b.millisecond ?? 0);
        if (aMs !== bMs) return false;
      }
      
      return true;
    } else {
      // One has timezone, one doesn't - can't determine equality
      return null;
    }
  }
  
  return false;
}

export function equivalent(a: TemporalValue, b: TemporalValue): boolean {
  // Different types are never equivalent
  if (a.kind !== b.kind) {
    return false;
  }
  
  // Different precision is false for equivalent
  if (a.precision.value !== b.precision.value) {
    return false;
  }
  
  // For same type and precision, use equals logic
  const result = equals(a, b);
  return result === true; // Convert null to false
}

export function compare(a: TemporalValue, b: TemporalValue): -1 | 0 | 1 | null {
  // Special case: DateTime and Date can be compared when date portions differ
  if (isFHIRDateTime(a) && isFHIRDate(b)) {
    // Compare the date portion of DateTime with Date
    if (a.year !== b.year) return a.year < b.year ? -1 : 1;
    if (b.month !== undefined) {
      if (a.month !== b.month) return a.month < b.month ? -1 : 1;
    }
    if (b.day !== undefined) {
      if (a.day !== b.day) return a.day < b.day ? -1 : 1;
    }
    // When date portions are equal, Date and DateTime are incomparable
    return null;
  }
  if (isFHIRDate(a) && isFHIRDateTime(b)) {
    // Compare Date with the date portion of DateTime
    if (a.year !== b.year) return a.year < b.year ? -1 : 1;
    if (a.month !== undefined) {
      if (a.month !== b.month) return a.month < b.month ? -1 : 1;
    }
    if (a.day !== undefined) {
      if (a.day !== b.day) return a.day < b.day ? -1 : 1;
    }
    // When date portions are equal, Date and DateTime are incomparable
    return null;
  }
  
  // Different types (except DateTime/Date) can't be compared
  if (a.kind !== b.kind) {
    return null;
  }
  
  if (isFHIRDate(a) && isFHIRDate(b)) {
    // Compare year (always present)
    if (a.year !== b.year) return a.year < b.year ? -1 : 1;
    
    // Compare month - if one has it and other doesn't, return null
    if (a.month !== undefined || b.month !== undefined) {
      if (a.month === undefined || b.month === undefined) return null;
      if (a.month !== b.month) return a.month < b.month ? -1 : 1;
    }
    
    // Compare day - if one has it and other doesn't, return null
    if (a.day !== undefined || b.day !== undefined) {
      if (a.day === undefined || b.day === undefined) return null;
      if (a.day !== b.day) return a.day < b.day ? -1 : 1;
    }
    
    return 0;
  }
  
  if (isFHIRTime(a) && isFHIRTime(b)) {
    // Compare hour (always present)
    if (a.hour !== b.hour) return a.hour < b.hour ? -1 : 1;
    
    // Compare minute - if one has it and other doesn't, return null
    if (a.minute !== undefined || b.minute !== undefined) {
      if (a.minute === undefined || b.minute === undefined) return null;
      if (a.minute !== b.minute) return a.minute < b.minute ? -1 : 1;
    }
    
    // Compare seconds+milliseconds as a single precision group
    if ((a.second !== undefined || a.millisecond !== undefined) ||
        (b.second !== undefined || b.millisecond !== undefined)) {
      const aHasSecondPrecision = a.second !== undefined || a.millisecond !== undefined;
      const bHasSecondPrecision = b.second !== undefined || b.millisecond !== undefined;
      if (!aHasSecondPrecision || !bHasSecondPrecision) return null;
      const aMs = (a.second ?? 0) * 1000 + (a.millisecond ?? 0);
      const bMs = (b.second ?? 0) * 1000 + (b.millisecond ?? 0);
      if (aMs !== bMs) return aMs < bMs ? -1 : 1;
    }
    
    return 0;
  }
  
  if (isFHIRDateTime(a) && isFHIRDateTime(b)) {
    // Handle timezone comparison
    if (a.timezoneOffset !== undefined && b.timezoneOffset !== undefined) {
      // Both have timezones - normalize to UTC
      const aUtc = normalizeToUTC(a);
      const bUtc = normalizeToUTC(b);
      
      // Compare year (always present)
      if (aUtc.year !== bUtc.year) return aUtc.year < bUtc.year ? -1 : 1;
      
      // Compare month
      if (aUtc.month !== undefined || bUtc.month !== undefined) {
        if (aUtc.month === undefined || bUtc.month === undefined) return null;
        if (aUtc.month !== bUtc.month) return aUtc.month < bUtc.month ? -1 : 1;
      }
      
      // Compare day
      if (aUtc.day !== undefined || bUtc.day !== undefined) {
        if (aUtc.day === undefined || bUtc.day === undefined) return null;
        if (aUtc.day !== bUtc.day) return aUtc.day < bUtc.day ? -1 : 1;
      }
      
      // Compare hour
      if (aUtc.hour !== undefined || bUtc.hour !== undefined) {
        if (aUtc.hour === undefined || bUtc.hour === undefined) return null;
        if (aUtc.hour !== bUtc.hour) return aUtc.hour < bUtc.hour ? -1 : 1;
      }
      
      // Compare minute
      if (aUtc.minute !== undefined || bUtc.minute !== undefined) {
        if (aUtc.minute === undefined || bUtc.minute === undefined) return null;
        if (aUtc.minute !== bUtc.minute) return aUtc.minute < bUtc.minute ? -1 : 1;
      }
      
      // Compare seconds+milliseconds as a single precision group
      if ((aUtc.second !== undefined || aUtc.millisecond !== undefined) ||
          (bUtc.second !== undefined || bUtc.millisecond !== undefined)) {
        const aHasSecondPrecision = aUtc.second !== undefined || aUtc.millisecond !== undefined;
        const bHasSecondPrecision = bUtc.second !== undefined || bUtc.millisecond !== undefined;
        if (!aHasSecondPrecision || !bHasSecondPrecision) return null;
        const aMs = (aUtc.second ?? 0) * 1000 + (aUtc.millisecond ?? 0);
        const bMs = (bUtc.second ?? 0) * 1000 + (bUtc.millisecond ?? 0);
        if (aMs !== bMs) return aMs < bMs ? -1 : 1;
      }
      
      return 0;
    } else if (a.timezoneOffset === undefined && b.timezoneOffset === undefined) {
      // Both naive - direct comparison
      // Compare year (always present)
      if (a.year !== b.year) return a.year < b.year ? -1 : 1;
      
      // Compare month
      if (a.month !== undefined || b.month !== undefined) {
        if (a.month === undefined || b.month === undefined) return null;
        if (a.month !== b.month) return a.month < b.month ? -1 : 1;
      }
      
      // Compare day
      if (a.day !== undefined || b.day !== undefined) {
        if (a.day === undefined || b.day === undefined) return null;
        if (a.day !== b.day) return a.day < b.day ? -1 : 1;
      }
      
      // Compare hour
      if (a.hour !== undefined || b.hour !== undefined) {
        if (a.hour === undefined || b.hour === undefined) return null;
        if (a.hour !== b.hour) return a.hour < b.hour ? -1 : 1;
      }
      
      // Compare minute
      if (a.minute !== undefined || b.minute !== undefined) {
        if (a.minute === undefined || b.minute === undefined) return null;
        if (a.minute !== b.minute) return a.minute < b.minute ? -1 : 1;
      }
      
      // Compare seconds+milliseconds as a single precision group
      if ((a.second !== undefined || a.millisecond !== undefined) ||
          (b.second !== undefined || b.millisecond !== undefined)) {
        const aHasSecondPrecision = a.second !== undefined || a.millisecond !== undefined;
        const bHasSecondPrecision = b.second !== undefined || b.millisecond !== undefined;
        if (!aHasSecondPrecision || !bHasSecondPrecision) return null;
        const aMs = (a.second ?? 0) * 1000 + (a.millisecond ?? 0);
        const bMs = (b.second ?? 0) * 1000 + (b.millisecond ?? 0);
        if (aMs !== bMs) return aMs < bMs ? -1 : 1;
      }
      
      return 0;
    } else {
      // Mixed timezone state - can't compare
      return null;
    }
  }
  
  return null;
}

// ============================================================================
// String Formatting
// ============================================================================

export function toTemporalString(value: TemporalValue): string {
  if (isFHIRDate(value)) {
    return formatDate(value);
  }
  if (isFHIRTime(value)) {
    return formatTime(value);
  }
  if (isFHIRDateTime(value)) {
    return formatDateTime(value);
  }
  return '';
}

export function toFHIRPathLiteral(value: TemporalValue): string {
  if (isFHIRDate(value)) {
    return `@${formatDate(value)}`;
  }
  if (isFHIRTime(value)) {
    return `@T${formatTime(value)}`;
  }
  if (isFHIRDateTime(value)) {
    return `@${formatDateTime(value)}`;
  }
  return '';
}

function formatDate(date: FHIRDate): string {
  const yearStr = date.year >= 0 && date.year < 10000 ? 
    String(date.year).padStart(4, '0') : 
    String(date.year);
  
  if (date.precision.level === 'year') {
    return yearStr;
  } else if (date.precision.level === 'month') {
    return `${yearStr}-${String(date.month).padStart(2, '0')}`;
  } else {
    return `${yearStr}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
  }
}

function formatTime(time: FHIRTime): string {
  let result = String(time.hour).padStart(2, '0');
  
  if (time.minute !== undefined) {
    result += ':' + String(time.minute).padStart(2, '0');
    
    if (time.second !== undefined) {
      result += ':' + String(time.second).padStart(2, '0');
      
      if (time.millisecond !== undefined) {
        result += '.' + String(time.millisecond).padStart(3, '0');
      }
    }
  }
  
  return result;
}

function formatDateTime(dt: FHIRDateTime): string {
  const yearStr = dt.year >= 0 && dt.year < 10000 ? 
    String(dt.year).padStart(4, '0') : 
    String(dt.year);
  
  let result = yearStr;
  
  if (dt.month !== undefined) {
    result += '-' + String(dt.month).padStart(2, '0');
    
    if (dt.day !== undefined) {
      result += '-' + String(dt.day).padStart(2, '0');
      
      if (dt.hour !== undefined) {
        result += 'T' + String(dt.hour).padStart(2, '0');
        
        if (dt.minute !== undefined) {
          result += ':' + String(dt.minute).padStart(2, '0');
          
          if (dt.second !== undefined) {
            result += ':' + String(dt.second).padStart(2, '0');
            
            if (dt.millisecond !== undefined) {
              result += '.' + String(dt.millisecond).padStart(3, '0');
            }
          }
        }
        
        // Add timezone
        if (dt.timezoneOffset !== undefined) {
          if (dt.timezoneOffset === 0) {
            result += 'Z';
          } else {
            const sign = dt.timezoneOffset < 0 ? '-' : '+';
            const absOffset = Math.abs(dt.timezoneOffset);
            const hours = Math.floor(absOffset / 60);
            const minutes = absOffset % 60;
            result += sign + String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
          }
        }
      }
      // No T suffix when we have complete date (year-month-day) but no time
    } else {
      // Month precision with T suffix (partial date)
      result += 'T';
    }
  } else {
    // Year precision with T suffix (partial date)
    result += 'T';
  }
  
  return result;
}

// ============================================================================
// Parsing
// ============================================================================

export function parseTemporalLiteral(literal: string): TemporalValue {
  if (!literal.startsWith('@')) {
    throw new Error('Temporal literal must start with @');
  }
  
  const value = literal.substring(1);
  
  // Time literal: @T...
  if (value.startsWith('T')) {
    return parseTimeLiteral(value.substring(1));
  }
  
  // Check for DateTime vs Date
  const hasTimeComponent = /T\d/.test(value);
  
  if (hasTimeComponent) {
    return parseDateTimeLiteral(value);
  } else if (value.endsWith('T')) {
    // DateTime with only date precision
    return parseDateTimeLiteral(value.slice(0, -1));
  } else {
    // Date literal
    return parseDateLiteral(value);
  }
}

function parseDateLiteral(value: string): FHIRDate {
  const match = value.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
  if (!match) {
    throw new Error(`Invalid date literal: @${value}`);
  }
  
  const year = parseInt(match[1]!, 10);
  const month = match[2] ? parseInt(match[2]!, 10) : undefined;
  const day = match[3] ? parseInt(match[3]!, 10) : undefined;
  
  return createDate(year, month, day);
}

function parseTimeLiteral(value: string): FHIRTime {
  const match = value.match(/^(\d{2})(?::(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?$/);
  if (!match) {
    throw new Error(`Invalid time literal: @T${value}`);
  }
  
  const hour = parseInt(match[1]!, 10);
  const minute = match[2] ? parseInt(match[2]!, 10) : undefined;
  const second = match[3] ? parseInt(match[3]!, 10) : undefined;
  // Handle variable-length fractional seconds (pad or truncate to 3 digits)
  let millisecond: number | undefined;
  if (match[4]) {
    const fraction = match[4];
    // Pad to 3 digits if needed, truncate if longer
    const padded = (fraction + '000').substring(0, 3);
    millisecond = parseInt(padded, 10);
  }
  
  return createTime(hour, minute, second, millisecond);
}

function parseDateTimeLiteral(value: string): FHIRDateTime {
  // Remove trailing T if present (for date-only DateTime)
  const cleanValue = value.endsWith('T') ? value.slice(0, -1) : value;
  
  // Split into date and time parts
  const parts = cleanValue.split('T');
  const datePart = parts[0];
  const timePart = parts[1];
  
  // Parse date part
  const dateMatch = datePart?.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
  if (!dateMatch) {
    throw new Error(`Invalid datetime literal: @${value}`);
  }
  
  const year = parseInt(dateMatch[1]!, 10);
  const month = dateMatch[2] ? parseInt(dateMatch[2]!, 10) : undefined;
  const day = dateMatch[3] ? parseInt(dateMatch[3]!, 10) : undefined;
  
  let hour: number | undefined;
  let minute: number | undefined;
  let second: number | undefined;
  let millisecond: number | undefined;
  let timezoneOffset: number | undefined;
  
  // Parse time part if present
  if (timePart) {
    // Extract timezone
    let timeWithoutTz = timePart;
    const tzMatch = timePart.match(/(Z|[+-]\d{2}:\d{2})$/);
    
    if (tzMatch) {
      timeWithoutTz = timePart.substring(0, timePart.length - tzMatch[0].length);
      const tz = tzMatch[0];
      
      if (tz === 'Z') {
        timezoneOffset = 0;
      } else {
        const tzParts = tz.match(/([+-])(\d{2}):(\d{2})/);
        if (tzParts) {
          const sign = tzParts[1] === '+' ? 1 : -1;
          const hours = parseInt(tzParts[2]!, 10);
          const minutes = parseInt(tzParts[3]!, 10);
          timezoneOffset = sign * (hours * 60 + minutes);
        }
      }
    }
    
    // Parse time components - handle variable-length milliseconds
    const timeMatch = timeWithoutTz.match(/^(\d{2})(?::(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?$/);
    if (timeMatch) {
      hour = parseInt(timeMatch[1]!, 10);
      minute = timeMatch[2] ? parseInt(timeMatch[2]!, 10) : undefined;
      second = timeMatch[3] ? parseInt(timeMatch[3]!, 10) : undefined;
      // Handle variable-length fractional seconds (pad or truncate to 3 digits)
      if (timeMatch[4]) {
        const fraction = timeMatch[4];
        // Pad to 3 digits if needed, truncate if longer
        const padded = (fraction + '000').substring(0, 3);
        millisecond = parseInt(padded, 10);
      }
    }
  }
  
  return createDateTime(year, month, day, hour, minute, second, millisecond, timezoneOffset);
}

// ============================================================================
// Arithmetic Operations
// ============================================================================

const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;
const DAYS_PER_WEEK = 7;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;

function normalizeUnit(unit: string): string {
  // Handle UCUM units
  const ucumMap: Record<string, string> = {
    // 'a' (annum) is not supported for temporal arithmetic - use 'year' keyword
    'mo': 'month',    // month
    'wk': 'week',     // week
    'd': 'day',       // day
    'h': 'hour',      // hour
    'min': 'minute',  // minute
    's': 'second',    // second
    'ms': 'millisecond' // millisecond
  };
  
  if (ucumMap[unit]) {
    return ucumMap[unit];
  }
  
  // Remove plurals for regular units
  if (unit.endsWith('s') && unit !== 's' && unit !== 'ms') {
    return unit.slice(0, -1);
  }
  
  return unit;
}

function convertAndTruncate(quantity: TimeQuantity, targetUnit: string): number {
  const normalizedQuantityUnit = normalizeUnit(quantity.unit);
  
  // Direct conversion for calendar units (year <-> month)
  if (normalizedQuantityUnit === 'month' && targetUnit === 'year') {
    return Math.trunc(quantity.value / 12);
  }
  if (normalizedQuantityUnit === 'year' && targetUnit === 'month') {
    return Math.trunc(quantity.value * 12);
  }
  
  let valueInDays = 0;
  
  // Convert to days first
  switch (normalizedQuantityUnit) {
    case 'year':
      valueInDays = quantity.value * DAYS_PER_YEAR;
      break;
    case 'month':
      valueInDays = quantity.value * DAYS_PER_MONTH;
      break;
    case 'week':
      valueInDays = quantity.value * DAYS_PER_WEEK;
      break;
    case 'day':
      valueInDays = quantity.value;
      break;
    case 'hour':
      valueInDays = quantity.value / HOURS_PER_DAY;
      break;
    case 'minute':
      valueInDays = quantity.value / (HOURS_PER_DAY * MINUTES_PER_HOUR);
      break;
    case 'second':
      valueInDays = quantity.value / (HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE);
      break;
    case 'millisecond':
      valueInDays = quantity.value / (HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND);
      break;
  }
  
  // Convert from days to target unit - use Math.trunc for truncation towards zero
  switch (targetUnit) {
    case 'year':
      return Math.trunc(valueInDays / DAYS_PER_YEAR);
    case 'month':
      return Math.trunc(valueInDays / DAYS_PER_MONTH);
    case 'day':
      return Math.trunc(valueInDays);
    case 'hour':
      return Math.trunc(valueInDays * HOURS_PER_DAY);
    case 'minute':
      return Math.trunc(valueInDays * HOURS_PER_DAY * MINUTES_PER_HOUR);
    case 'second':
      return Math.trunc(valueInDays * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE);
    case 'millisecond':
      return Math.trunc(valueInDays * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND);
    default:
      return 0;
  }
}

export function add(temporal: TemporalValue, quantity: TimeQuantity): TemporalValue {
  if (isFHIRDate(temporal)) {
    return addToDate(temporal, quantity);
  }
  if (isFHIRTime(temporal)) {
    return addToTime(temporal, quantity);
  }
  if (isFHIRDateTime(temporal)) {
    return addToDateTime(temporal, quantity);
  }
  return temporal;
}

export function subtract(temporal: TemporalValue, quantity: TimeQuantity): TemporalValue {
  const negativeQuantity = createTimeQuantity(-quantity.value, quantity.unit);
  return add(temporal, negativeQuantity);
}

// Helper to get the maximum day for a given month/year
export function getDaysInMonth(year: number, month: number): number {
  if (month === 2) {
    // February - check for leap year
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    return isLeapYear ? 29 : 28;
  } else if ([4, 6, 9, 11].includes(month)) {
    return 30;
  } else {
    return 31;
  }
}

// Helper to clamp a day to the valid range for a month
function clampDay(year: number, month: number | undefined, day: number | undefined): number | undefined {
  if (day === undefined || month === undefined) {
    return day;
  }
  const maxDay = getDaysInMonth(year, month);
  return Math.min(day, maxDay);
}

function addToDate(date: FHIRDate, quantity: TimeQuantity): FHIRDate {
  // Check for unsupported UCUM units
  if ((quantity.unit as string) === 'a') {
    throw Errors.invalidTemporalUnit('Date', quantity.unit as string);
  }

  const normalizedUnit = normalizeUnit(quantity.unit);

  // Only year/month/week/day units allowed for Date per spec
  if (!['year', 'month', 'week', 'day'].includes(normalizedUnit)) {
    // Includes hour/minute/second/millisecond and any other non-calendar unit
    throw Errors.unsupportedTemporalUnitForType('Date', quantity.unit as string);
  }

  const cal = addCalendarParts(
    date.year,
    date.month,
    date.day,
    normalizedUnit as CalendarUnit,
    quantity.value
  );
  return createDate(cal.year, cal.month, cal.day);
}

function addToTime(time: FHIRTime, quantity: TimeQuantity): FHIRTime {
  // Check for unsupported UCUM units
  if ((quantity.unit as string) === 'a') {
    throw new Error("Cannot use variable-duration unit 'a' with Time - use calendar duration keywords instead");
  }
  
  const normalizedUnit = normalizeUnit(quantity.unit);
  
  // Only time units allowed
  if (!['hour', 'minute', 'second', 'millisecond'].includes(normalizedUnit)) {
    throw new Error(`Cannot add ${quantity.unit} to Time`);
  }
  
  // Convert everything to milliseconds
  let totalMs = time.hour * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
  
  if (time.minute !== undefined) {
    totalMs += time.minute * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
  }
  if (time.second !== undefined) {
    totalMs += time.second * MILLISECONDS_PER_SECOND;
  }
  if (time.millisecond !== undefined) {
    totalMs += time.millisecond;
  }
  
  // Add the quantity in milliseconds
  let quantityMs = 0;
  switch (normalizedUnit) {
    case 'hour':
      // For precisions above seconds, ignore decimal portion per spec
      quantityMs = Math.trunc(quantity.value) * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
      break;
    case 'minute':
      // For precisions above seconds, ignore decimal portion per spec
      quantityMs = Math.trunc(quantity.value) * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
      break;
    case 'second':
      quantityMs = quantity.value * MILLISECONDS_PER_SECOND;
      break;
    case 'millisecond':
      quantityMs = quantity.value;
      break;
  }
  
  totalMs += quantityMs;
  
  // Wrap around 24 hours
  const dayMs = HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
  totalMs = totalMs % dayMs;
  if (totalMs < 0) {
    totalMs += dayMs;
  }
  
  // Convert back to components
  const newHour = Math.floor(totalMs / (MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND));
  totalMs %= MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
  
  let newMinute: number | undefined;
  let newSecond: number | undefined;
  let newMillisecond: number | undefined;
  
  if (time.minute !== undefined) {
    newMinute = Math.floor(totalMs / (SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND));
    totalMs %= SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
  }
  
  if (time.second !== undefined) {
    newSecond = Math.floor(totalMs / MILLISECONDS_PER_SECOND);
    totalMs %= MILLISECONDS_PER_SECOND;
    
    // Include milliseconds if original had them OR if we have fractional seconds
    if (time.millisecond !== undefined || totalMs > 0) {
      newMillisecond = Math.floor(totalMs);
    }
  } else if (time.millisecond !== undefined) {
    newMillisecond = Math.floor(totalMs);
  }
  
  return createTime(newHour, newMinute, newSecond, newMillisecond);
}

function addToDateTime(dt: FHIRDateTime, quantity: TimeQuantity): FHIRDateTime {
  // Check for unsupported UCUM units
  if ((quantity.unit as string) === 'a') {
    throw new Error("Cannot use variable-duration unit 'a' with DateTime - use calendar duration keywords instead");
  }
  
  const normalizedUnit = normalizeUnit(quantity.unit);
  let newYear = dt.year;
  let newMonth = dt.month;
  let newDay = dt.day;
  let newHour = dt.hour;
  let newMinute = dt.minute;
  let newSecond = dt.second;
  let newMillisecond = dt.millisecond;

  // Calendar units: delegate to shared helper
  if (['year', 'month', 'week', 'day'].includes(normalizedUnit)) {
    const cal = addCalendarParts(newYear, newMonth, newDay, normalizedUnit as CalendarUnit, quantity.value);
    newYear = cal.year;
    newMonth = cal.month;
    newDay = cal.day;
    return createDateTime(newYear, newMonth, newDay, newHour, newMinute, newSecond, newMillisecond, dt.timezoneOffset);
  }

  // Time units: delegate to clock helper with precision preservation
  if (['hour', 'minute', 'second', 'millisecond'].includes(normalizedUnit)) {
    const clock = addClockParts(
      dt.hour,
      dt.minute,
      dt.second,
      dt.millisecond,
      normalizedUnit as ClockUnit,
      quantity.value,
      true
    );
    newHour = clock.hour;
    newMinute = clock.minute;
    newSecond = clock.second;
    newMillisecond = clock.millisecond;

    if (clock.dayDelta !== 0) {
      const cal = addCalendarParts(newYear, newMonth, newDay, 'day', clock.dayDelta);
      newYear = cal.year;
      newMonth = cal.month;
      newDay = cal.day;
    }
    return createDateTime(newYear, newMonth, newDay, newHour, newMinute, newSecond, newMillisecond, dt.timezoneOffset);
  }

  return createDateTime(newYear, newMonth, newDay, newHour, newMinute, newSecond, newMillisecond, dt.timezoneOffset);
}

// ============================================================================
// Component Extraction
// ============================================================================

export function yearOf(temporal: TemporalValue): number | null {
  if (isFHIRDate(temporal) || isFHIRDateTime(temporal)) {
    return temporal.year;
  }
  return null;
}

export function monthOf(temporal: TemporalValue): number | null {
  if (isFHIRDate(temporal) || isFHIRDateTime(temporal)) {
    return temporal.month ?? null;
  }
  return null;
}

export function dayOf(temporal: TemporalValue): number | null {
  if (isFHIRDate(temporal) || isFHIRDateTime(temporal)) {
    return temporal.day ?? null;
  }
  return null;
}

export function hourOf(temporal: TemporalValue): number | null {
  if (isFHIRTime(temporal)) {
    return temporal.hour;
  }
  if (isFHIRDateTime(temporal)) {
    return temporal.hour ?? null;
  }
  return null;
}

export function minuteOf(temporal: TemporalValue): number | null {
  if (isFHIRTime(temporal)) {
    return temporal.minute ?? null;
  }
  if (isFHIRDateTime(temporal)) {
    return temporal.minute ?? null;
  }
  return null;
}

export function secondOf(temporal: TemporalValue): number | null {
  if (isFHIRTime(temporal)) {
    return temporal.second ?? null;
  }
  if (isFHIRDateTime(temporal)) {
    return temporal.second ?? null;
  }
  return null;
}

export function millisecondOf(temporal: TemporalValue): number | null {
  if (isFHIRTime(temporal)) {
    return temporal.millisecond ?? null;
  }
  if (isFHIRDateTime(temporal)) {
    return temporal.millisecond ?? null;
  }
  return null;
}

// ============================================================================
// Helper Functions
// ============================================================================

// Shared helper scaffolding for refactor (TDD-first)
export type CalendarUnit = 'year' | 'month' | 'week' | 'day';
export type ClockUnit = 'hour' | 'minute' | 'second' | 'millisecond';

export interface CalendarPartsResult {
  year: number;
  month?: number;
  day?: number;
}

export interface ClockPartsResult {
  hour?: number;
  minute?: number;
  second?: number;
  millisecond?: number;
  // +1 when time addition crosses midnight forward, -1 when backward, 0 otherwise
  dayDelta: number;
}

// Intentionally left unimplemented for now (tests drive implementation)
export function addCalendarParts(
  year: number,
  month: number | undefined,
  day: number | undefined,
  unit: CalendarUnit,
  amount: number
): CalendarPartsResult {
  const normalizedUnit = normalizeUnit(unit);

  let newYear = year;
  let newMonth = month;
  let newDay = day;

  if (normalizedUnit === 'week') {
    // Convert weeks to days using calendar semantics (truncate fractional weeks)
    const weeksToAdd = Math.trunc(amount);
    return addCalendarParts(newYear, newMonth, newDay, 'day', weeksToAdd * 7);
  }

  if (normalizedUnit === 'year') {
    newYear += Math.trunc(amount);
  } else if (normalizedUnit === 'month') {
    const monthsToAdd = Math.trunc(amount);
    if (newMonth !== undefined) {
      let totalMonths = (newYear * 12) + (newMonth - 1) + monthsToAdd;
      newYear = Math.floor(totalMonths / 12);
      newMonth = (totalMonths % 12) + 1;
      if (newMonth <= 0) {
        newMonth += 12;
        newYear--;
      }
    } else {
      // Coerce months into years when only year precision
      const yearsToAdd = convertAndTruncate(createTimeQuantity(amount, 'month'), 'year');
      newYear += yearsToAdd;
    }
  } else if (normalizedUnit === 'day') {
    const daysToAdd = Math.trunc(amount);
    if (newDay !== undefined && newMonth !== undefined) {
      // Proper calendar day arithmetic
      let currentYear = newYear;
      let currentMonth = newMonth;
      let currentDay = newDay + daysToAdd;

      while (currentDay > getDaysInMonth(currentYear, currentMonth)) {
        currentDay -= getDaysInMonth(currentYear, currentMonth);
        currentMonth++;
        if (currentMonth > 12) {
          currentMonth = 1;
          currentYear++;
        }
      }

      while (currentDay < 1) {
        currentMonth--;
        if (currentMonth < 1) {
          currentMonth = 12;
          currentYear--;
        }
        currentDay += getDaysInMonth(currentYear, currentMonth);
      }

      newYear = currentYear;
      newMonth = currentMonth;
      newDay = currentDay;
    } else if (newMonth !== undefined) {
      // Convert days to months when month precision but no day
      const monthsToAdd = convertAndTruncate(createTimeQuantity(amount, 'day'), 'month');
      let totalMonths = (newYear * 12) + (newMonth - 1) + monthsToAdd;
      newYear = Math.floor(totalMonths / 12);
      newMonth = (totalMonths % 12) + 1;
      if (newMonth <= 0) {
        newMonth += 12;
        newYear--;
      }
    } else {
      // Convert days to years when only year precision
      const yearsToAdd = convertAndTruncate(createTimeQuantity(amount, 'day'), 'year');
      newYear += yearsToAdd;
    }
  }

  // Clamp day for validity when we have a day and month
  newDay = clampDay(newYear, newMonth, newDay);

  return { year: newYear, month: newMonth, day: newDay };
}

// Intentionally left unimplemented for now (tests drive implementation)
export function addClockParts(
  hour: number | undefined,
  minute: number | undefined,
  second: number | undefined,
  millisecond: number | undefined,
  unit: ClockUnit,
  amount: number,
  preservePrecision: boolean = true
): ClockPartsResult {
  const HOUR_MS = MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
  const MINUTE_MS = SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
  const SECOND_MS = MILLISECONDS_PER_SECOND;
  const DAY_MS = HOURS_PER_DAY * HOUR_MS;

  // Build original total milliseconds from time-of-day
  let totalMs = (hour ?? 0) * HOUR_MS;
  if (minute !== undefined) totalMs += minute * MINUTE_MS;
  if (second !== undefined) totalMs += second * SECOND_MS;
  if (millisecond !== undefined) totalMs += millisecond;

  // Compute quantity in milliseconds honoring truncation rules
  let deltaMs = 0;
  if (unit === 'hour') {
    deltaMs = Math.trunc(amount) * HOUR_MS;
  } else if (unit === 'minute') {
    // precision-preserving: we'll add minutes as milliseconds, but reconstruction preserves precision
    deltaMs = Math.trunc(amount) * MINUTE_MS;
  } else if (unit === 'second') {
    deltaMs = amount * SECOND_MS; // fractions become milliseconds
  } else if (unit === 'millisecond') {
    deltaMs = amount;
  }

  const newTotal = totalMs + deltaMs;
  // Compute dayDelta via floor division and get a non-negative wrapped remainder
  let dayDelta = Math.floor(newTotal / DAY_MS);
  let wrapped = newTotal - dayDelta * DAY_MS;

  // Reconstruct time parts with precision preservation
  // Preserve hour precision: if hour was undefined, don't materialize it
  let newHour: number | undefined =
    hour !== undefined ? Math.floor(wrapped / HOUR_MS) : undefined;
  if (hour !== undefined) {
    wrapped %= HOUR_MS;
  }

  let newMinute: number | undefined = undefined;
  let newSecond: number | undefined = undefined;
  let newMillisecond: number | undefined = undefined;

  if (minute !== undefined) {
    newMinute = Math.floor(wrapped / MINUTE_MS);
    wrapped %= MINUTE_MS;
  }

  if (second !== undefined) {
    newSecond = Math.floor(wrapped / SECOND_MS);
    wrapped %= SECOND_MS;
  }

  if (millisecond !== undefined) {
    newMillisecond = Math.floor(wrapped);
    wrapped = 0;
  } else if (!preservePrecision && (second !== undefined || minute !== undefined)) {
    // Only when explicitly allowed to introduce finer precision
    newMillisecond = Math.floor(wrapped);
    wrapped = 0;
  }

  return {
    hour: newHour,
    minute: newMinute,
    second: newSecond,
    millisecond: newMillisecond,
    dayDelta
  };
}

// Cache for UTC-normalized DateTimes to avoid repeated conversions
const utcNormalizationCache = new WeakMap<FHIRDateTime, FHIRDateTime>();

function normalizeToUTC(dt: FHIRDateTime): FHIRDateTime {
  if (dt.timezoneOffset === undefined || dt.timezoneOffset === 0) {
    return dt;
  }
  
  // Check cache first
  const cached = utcNormalizationCache.get(dt);
  if (cached) {
    return cached;
  }
  
  // Convert to total minutes and adjust
  let totalMinutes = (dt.hour ?? 0) * 60 + (dt.minute ?? 0) - dt.timezoneOffset;
  
  // Handle day boundary crossing
  let dayAdjust = 0;
  if (totalMinutes < 0) {
    dayAdjust = -Math.ceil(Math.abs(totalMinutes) / (24 * 60));
    totalMinutes += Math.abs(dayAdjust) * 24 * 60;
  } else if (totalMinutes >= 24 * 60) {
    dayAdjust = Math.floor(totalMinutes / (24 * 60));
    totalMinutes %= 24 * 60;
  }
  
  const newHour = Math.floor(totalMinutes / 60);
  const newMinute = totalMinutes % 60;
  
  // Adjust day if needed
  let newDay = dt.day;
  let newMonth = dt.month;
  let newYear = dt.year;
  
  if (dayAdjust !== 0 && newDay !== undefined && newMonth !== undefined) {
    // Use proper calendar arithmetic for day adjustment
    const tempDate = createDate(newYear, newMonth, newDay);
    const dayQuantity = createTimeQuantity(dayAdjust, 'day');
    const adjustedDate = addToDate(tempDate, dayQuantity);
    newYear = adjustedDate.year;
    newMonth = adjustedDate.month;
    newDay = adjustedDate.day;
  }
  
  const result: FHIRDateTime = {
    kind: 'FHIRDateTime',
    year: newYear,
    month: newMonth,
    day: newDay,
    hour: dt.hour !== undefined ? newHour : undefined,
    minute: dt.minute !== undefined ? newMinute : undefined,
    second: dt.second,
    millisecond: dt.millisecond,
    timezoneOffset: 0,
    precision: dt.precision
  };
  
  // Store in cache for future lookups
  utcNormalizationCache.set(dt, result);
  
  return result;
}

// ============================================================================
// Backwards Compatibility Exports (temporary during migration)
// ============================================================================

// Export classes that map to factory functions
export const FHIRDate = {
  new: createDate,
  create: createDate
};

export const FHIRTime = {
  new: createTime,
  create: createTime
};

export const FHIRDateTime = {
  new: createDateTime,
  create: createDateTime
};

// ============================================================================
// Boundary Functions
// ============================================================================

/**
 * Calculate the low boundary for a Date value
 */
export function getDateLowBoundary(date: FHIRDate, precision?: number): FHIRDate | null {
  // Validate precision
  if (precision !== undefined) {
    if (precision < 0 || precision > 8) {
      return null;
    }
  } else {
    // Default precision for Date is 8 (day)
    precision = 8;
  }
  
  // Build the boundary date based on precision
  let year = date.year;
  let month: number | undefined;
  let day: number | undefined;
  
  if (precision >= 6) {
    month = date.month ?? 1;
  }
  
  if (precision >= 8) {
    day = date.day ?? 1;
  }
  
  return createDate(year, month, day);
}

/**
 * Calculate the high boundary for a Date value
 */
export function getDateHighBoundary(date: FHIRDate, precision?: number): FHIRDate | null {
  // Validate precision
  if (precision !== undefined) {
    if (precision < 0 || precision > 8) {
      return null;
    }
  } else {
    // Default precision for Date is 8 (day)
    precision = 8;
  }
  
  // Build the boundary date based on precision
  let year = date.year;
  let month: number | undefined;
  let day: number | undefined;
  
  if (precision >= 6) {
    month = date.month ?? 12;
  }
  
  if (precision >= 8) {
    if (date.day !== undefined) {
      day = date.day;
    } else {
      // Need to calculate last day of month
      const actualMonth = month ?? 12;
      day = getDaysInMonth(year, actualMonth);
    }
  }
  
  return createDate(year, month, day);
}

/**
 * Calculate the low boundary for a DateTime value
 */
export function getDateTimeLowBoundary(dateTime: FHIRDateTime, precision?: number): FHIRDateTime | null {
  // Validate precision
  if (precision !== undefined) {
    if (precision < 0 || precision > 17) {
      return null;
    }
  } else {
    // Default precision for DateTime is 17 (millisecond)
    precision = 17;
  }
  
  // Build the boundary datetime based on precision
  let year = dateTime.year;
  let month: number | undefined;
  let day: number | undefined;
  let hour: number | undefined;
  let minute: number | undefined;
  let second: number | undefined;
  let millisecond: number | undefined;
  let timezoneOffset: number | undefined = dateTime.timezoneOffset;
  
  if (precision >= 6) {
    month = dateTime.month ?? 1;
  }
  
  if (precision >= 8) {
    day = dateTime.day ?? 1;
  }
  
  if (precision >= 10) {
    hour = dateTime.hour ?? 0;
  }
  
  if (precision >= 12) {
    minute = dateTime.minute ?? 0;
  }
  
  if (precision >= 14) {
    second = dateTime.second ?? 0;
  }
  
  if (precision >= 17) {
    millisecond = dateTime.millisecond ?? 0;
    
    // If no timezone was specified and we're at millisecond precision,
    // use the maximum positive offset (+14:00 = 840 minutes)
    if (timezoneOffset === undefined && dateTime.hour !== undefined) {
      timezoneOffset = 840; // +14:00
    }
  }
  
  return createDateTime(year, month, day, hour, minute, second, millisecond, timezoneOffset);
}

/**
 * Calculate the high boundary for a DateTime value
 */
export function getDateTimeHighBoundary(dateTime: FHIRDateTime, precision?: number): FHIRDateTime | null {
  // Validate precision
  if (precision !== undefined) {
    if (precision < 0 || precision > 17) {
      return null;
    }
  } else {
    // Default precision for DateTime is 17 (millisecond)
    precision = 17;
  }
  
  // Build the boundary datetime based on precision
  let year = dateTime.year;
  let month: number | undefined;
  let day: number | undefined;
  let hour: number | undefined;
  let minute: number | undefined;
  let second: number | undefined;
  let millisecond: number | undefined;
  let timezoneOffset: number | undefined = dateTime.timezoneOffset;
  
  if (precision >= 6) {
    month = dateTime.month ?? 12;
  }
  
  if (precision >= 8) {
    if (dateTime.day !== undefined) {
      day = dateTime.day;
    } else {
      // Need to calculate last day of month
      const actualMonth = month ?? 12;
      day = getDaysInMonth(year, actualMonth);
    }
  }
  
  if (precision >= 10) {
    hour = dateTime.hour ?? 23;
  }
  
  if (precision >= 12) {
    minute = dateTime.minute ?? 59;
  }
  
  if (precision >= 14) {
    second = dateTime.second ?? 59;
  }
  
  if (precision >= 17) {
    millisecond = dateTime.millisecond ?? 999;
    
    // If no timezone was specified and we're at millisecond precision,
    // use the maximum negative offset (-12:00 = -720 minutes)
    if (timezoneOffset === undefined && dateTime.hour !== undefined) {
      timezoneOffset = -720; // -12:00
    }
  }
  
  return createDateTime(year, month, day, hour, minute, second, millisecond, timezoneOffset);
}

/**
 * Calculate the low boundary for a Time value
 */
export function getTimeLowBoundary(time: FHIRTime, precision?: number): FHIRTime | null {
  // Validate precision
  if (precision !== undefined) {
    if (precision < 0 || precision > 9) {
      return null;
    }
  } else {
    // Default precision for Time is 9 (millisecond)
    precision = 9;
  }
  
  // Build the boundary time based on precision
  let hour = time.hour;
  let minute: number | undefined;
  let second: number | undefined;
  let millisecond: number | undefined;
  
  if (precision >= 5) {
    minute = time.minute ?? 0;
  }
  
  if (precision >= 7) {
    second = time.second ?? 0;
  }
  
  if (precision >= 9) {
    millisecond = time.millisecond ?? 0;
  }
  
  return createTime(hour, minute, second, millisecond);
}

/**
 * Calculate the high boundary for a Time value
 */
export function getTimeHighBoundary(time: FHIRTime, precision?: number): FHIRTime | null {
  // Validate precision
  if (precision !== undefined) {
    if (precision < 0 || precision > 9) {
      return null;
    }
  } else {
    // Default precision for Time is 9 (millisecond)
    precision = 9;
  }
  
  // Build the boundary time based on precision
  let hour = time.hour;
  let minute: number | undefined;
  let second: number | undefined;
  let millisecond: number | undefined;
  
  if (precision >= 5) {
    minute = time.minute ?? 59;
  }
  
  if (precision >= 7) {
    second = time.second ?? 59;
  }
  
  if (precision >= 9) {
    millisecond = time.millisecond ?? 999;
  }
  
  return createTime(hour, minute, second, millisecond);
}
