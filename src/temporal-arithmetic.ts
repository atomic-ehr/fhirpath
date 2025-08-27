// Temporal Arithmetic Implementation
// Following ADR-017: Temporal Values Implementation

import {
  FHIRDate,
  FHIRDateTime,
  FHIRTime,
  PRECISION_VALUES,
  type TimeQuantity,
  type DatePrecisionLevel,
  type TimePrecisionLevel,
  type DateTimePrecisionLevel,
} from './temporal';

// ============================================================================
// Conversion Utilities
// ============================================================================

const DAYS_PER_MONTH = 30; // FHIRPath convention
const DAYS_PER_YEAR = 365; // FHIRPath convention
const DAYS_PER_WEEK = 7;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;

/**
 * Convert a time quantity to a different unit, truncating the result
 */
function convertAndTruncate(quantity: TimeQuantity, targetUnit: string): number {
  // Normalize unit first (remove plurals)
  const normalizedQuantityUnit = normalizeUnit(quantity.unit);
  
  // Direct conversion for calendar units (year <-> month)
  // Avoids precision loss from going through days
  if (normalizedQuantityUnit === 'month' && targetUnit === 'year') {
    return Math.floor(quantity.value / 12);
  }
  if (normalizedQuantityUnit === 'year' && targetUnit === 'month') {
    return Math.floor(quantity.value * 12);
  }
  
  let valueInDays = 0;
  
  // Convert to days first (common unit)
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
  
  // Convert from days to target unit
  let result = 0;
  switch (targetUnit) {
    case 'year':
      result = valueInDays / DAYS_PER_YEAR;
      break;
    case 'month':
      result = valueInDays / DAYS_PER_MONTH;
      break;
    case 'week':
      result = valueInDays / DAYS_PER_WEEK;
      break;
    case 'day':
      result = valueInDays;
      break;
    case 'hour':
      result = valueInDays * HOURS_PER_DAY;
      break;
    case 'minute':
      result = valueInDays * HOURS_PER_DAY * MINUTES_PER_HOUR;
      break;
    case 'second':
      result = valueInDays * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE;
      break;
    case 'millisecond':
      result = valueInDays * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
      break;
  }
  
  // Truncate toward zero (not floor) for proper coercion
  return Math.trunc(result);
}

/**
 * Get precision ranking for comparison
 */
function getPrecisionRank(precision: string): number {
  const ranks: Record<string, number> = {
    'year': 1,
    'month': 2,
    'week': 3,
    'day': 3, // Week and day have same rank
    'hour': 4,
    'minute': 5,
    'second': 6,
    'millisecond': 7,
  };
  return ranks[precision] || 0;
}

/**
 * Normalize time unit to singular form
 */
function normalizeUnit(unit: string): string {
  // Handle single letter 's' for seconds
  if (unit === 's') {
    return 'second';
  }
  // Remove plural 's' if present
  if (unit.endsWith('s') && unit !== 'milliseconds' && unit.length > 1) {
    return unit.slice(0, -1);
  }
  if (unit === 'milliseconds') {
    return 'millisecond';
  }
  return unit;
}

// ============================================================================
// Date Arithmetic
// ============================================================================

/**
 * Check if a year is a leap year
 */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Get the number of days in a month
 */
function daysInMonth(year: number, month: number): number {
  const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2 && isLeapYear(year)) {
    return 29;
  }
  return daysPerMonth[month - 1]!;
}

/**
 * Validate and adjust date components for calendar validity
 */
function adjustDateForValidity(year: number, month: number, day: number): { year: number; month: number; day: number } {
  // Handle month overflow/underflow
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  
  // Adjust day to be valid for the month
  const maxDay = daysInMonth(year, month);
  if (day > maxDay) {
    day = maxDay;
  }
  if (day < 1) {
    day = 1;
  }
  
  // Validate year bounds
  if (year < 1) year = 1;
  if (year > 9999) year = 9999;
  
  return { year, month, day };
}

/**
 * Add to Date with FHIRPath precision rules
 */
export function addToDate(date: FHIRDate, quantity: TimeQuantity): FHIRDate {
  const normalizedUnit = normalizeUnit(quantity.unit);
  const quantityRank = getPrecisionRank(normalizedUnit);
  const dateRank = getPrecisionRank(date.precision.level);
  
  // Core decision: coerce if date precision is lower than quantity precision
  if (dateRank < quantityRank) {
    // Coercion path: convert quantity to date's precision level
    const coercedValue = convertAndTruncate(quantity, date.precision.level);
    
    if (date.precision.level === 'year') {
      return new FHIRDate(date.year + coercedValue);
    } else if (date.precision.level === 'month') {
      let newMonth = (date.month || 1) + coercedValue;
      let newYear = date.year;
      
      // Handle month overflow
      while (newMonth > 12) {
        newMonth -= 12;
        newYear += 1;
      }
      while (newMonth < 1) {
        newMonth += 12;
        newYear -= 1;
      }
      
      return new FHIRDate(newYear, newMonth);
    }
  }
  
  // Calendar arithmetic path
  let year = date.year;
  let month = date.month || 1;
  let day = date.day || 1;
  
  switch (normalizedUnit) {
    case 'year':
      year += Math.floor(quantity.value);
      break;
      
    case 'month':
      const monthsToAdd = Math.floor(quantity.value);
      month += monthsToAdd;
      
      // Handle overflow/underflow properly
      while (month > 12) {
        month -= 12;
        year += 1;
      }
      while (month < 1) {
        month += 12;
        year -= 1;
      }
      break;
      
    case 'week':
      // For weeks, truncate to integer weeks (FHIRPath behavior)
      // Use Math.trunc to truncate towards zero (not floor which rounds down)
      day += Math.trunc(quantity.value) * 7;
      break;
      
    case 'day':
      // For calendar days, truncate to integer (ignore decimal part)
      day += Math.trunc(quantity.value);
      break;
      
    default:
      // For time units with Date, convert to days
      if (date.precision.level === 'day') {
        const days = convertAndTruncate(quantity, 'day');
        day += days;
      }
  }
  
  // Adjust for calendar validity
  const adjusted = adjustDateForValidity(year, month, day);
  
  // Handle date arithmetic that changes months/days
  if (date.precision.level === 'day' && (normalizedUnit === 'day' || normalizedUnit === 'week')) {
    // Need to handle month/year rollovers properly
    // Round fractional days to nearest integer
    const roundedDay = Math.round(day);
    const jsDate = new Date(year, month - 1, roundedDay);
    let resultYear = jsDate.getFullYear();
    // Clamp year to valid range
    if (resultYear > 9999) resultYear = 9999;
    if (resultYear < 1) resultYear = 1;
    return new FHIRDate(resultYear, jsDate.getMonth() + 1, jsDate.getDate());
  }
  
  // Preserve original precision
  if (date.precision.level === 'year') {
    return new FHIRDate(adjusted.year);
  } else if (date.precision.level === 'month') {
    return new FHIRDate(adjusted.year, adjusted.month);
  } else {
    return new FHIRDate(adjusted.year, adjusted.month, adjusted.day);
  }
}

/**
 * Subtract from Date with FHIRPath precision rules
 */
export function subtractFromDate(date: FHIRDate, quantity: TimeQuantity): FHIRDate {
  // Negate the quantity and use addition
  const negatedQuantity: TimeQuantity = {
    value: -quantity.value,
    unit: quantity.unit,
    isCalendarUnit: quantity.isCalendarUnit,
  };
  return addToDate(date, negatedQuantity);
}

// ============================================================================
// Time Arithmetic
// ============================================================================

/**
 * Add to Time with FHIRPath precision rules
 */
export function addToTime(time: FHIRTime, quantity: TimeQuantity): FHIRTime {
  // Time cannot accept calendar units
  if (quantity.isCalendarUnit) {
    throw new Error(`Cannot add calendar unit ${quantity.unit} to Time value`);
  }
  
  const normalizedUnit = normalizeUnit(quantity.unit);
  const quantityRank = getPrecisionRank(normalizedUnit);
  const timeRank = getPrecisionRank(time.precision.level);
  
  // Core decision: coerce if time precision is lower than quantity precision
  if (timeRank < quantityRank) {
    // Coercion path
    const coercedValue = convertAndTruncate(quantity, time.precision.level);
    
    if (time.precision.level === 'hour') {
      let newHour = (time.hour + coercedValue) % 24;
      if (newHour < 0) newHour += 24;
      return new FHIRTime(newHour);
    } else if (time.precision.level === 'minute') {
      const totalMinutes = time.hour * 60 + (time.minute || 0) + coercedValue;
      let newHour = Math.floor(totalMinutes / 60) % 24;
      let newMinute = totalMinutes % 60;
      if (newHour < 0) newHour += 24;
      if (newMinute < 0) {
        newMinute += 60;
        newHour -= 1;
        if (newHour < 0) newHour += 24;
      }
      return new FHIRTime(newHour, newMinute);
    }
  }
  
  // Clock arithmetic path
  let totalMilliseconds = 
    time.hour * 3600000 +
    (time.minute || 0) * 60000 +
    (time.second || 0) * 1000 +
    (time.millisecond || 0);
  
  switch (normalizedUnit) {
    case 'hour':
      // For hours, truncate to integer (ignore decimal part)
      totalMilliseconds += Math.trunc(quantity.value) * 3600000;
      break;
    case 'minute':
      // For minutes, truncate to integer (ignore decimal part)
      totalMilliseconds += Math.trunc(quantity.value) * 60000;
      break;
    case 'second':
      // Seconds and milliseconds keep decimal parts
      totalMilliseconds += quantity.value * 1000;
      break;
    case 'millisecond':
      totalMilliseconds += quantity.value;
      break;
  }
  
  // Wrap around 24 hours
  totalMilliseconds = totalMilliseconds % (24 * 3600000);
  if (totalMilliseconds < 0) {
    totalMilliseconds += 24 * 3600000;
  }
  
  const newHour = Math.floor(totalMilliseconds / 3600000);
  const newMinute = Math.floor((totalMilliseconds % 3600000) / 60000);
  const newSecond = Math.floor((totalMilliseconds % 60000) / 1000);
  const newMillisecond = totalMilliseconds % 1000;
  
  // Result precision should be the more precise of the two
  // If we're adding milliseconds to a time with second precision,
  // the result should have millisecond precision
  // Also, if the result has non-zero milliseconds, we need millisecond precision
  let resultPrecision = quantityRank > timeRank ? normalizedUnit : time.precision.level;
  
  // If we have non-zero milliseconds, upgrade to millisecond precision
  if (newMillisecond !== 0 && getPrecisionRank(resultPrecision) < getPrecisionRank('millisecond')) {
    resultPrecision = 'millisecond';
  }
  
  if (resultPrecision === 'hour') {
    return new FHIRTime(newHour);
  } else if (resultPrecision === 'minute') {
    return new FHIRTime(newHour, newMinute);
  } else if (resultPrecision === 'second') {
    return new FHIRTime(newHour, newMinute, newSecond);
  } else {
    return new FHIRTime(newHour, newMinute, newSecond, newMillisecond);
  }
}

/**
 * Subtract from Time with FHIRPath precision rules
 */
export function subtractFromTime(time: FHIRTime, quantity: TimeQuantity): FHIRTime {
  // Negate the quantity and use addition
  const negatedQuantity: TimeQuantity = {
    value: -quantity.value,
    unit: quantity.unit,
    isCalendarUnit: false,
  };
  return addToTime(time, negatedQuantity);
}

// ============================================================================
// DateTime Arithmetic
// ============================================================================

/**
 * Add to DateTime with FHIRPath precision rules
 */
export function addToDateTime(dt: FHIRDateTime, quantity: TimeQuantity): FHIRDateTime {
  const normalizedUnit = normalizeUnit(quantity.unit);
  const quantityRank = getPrecisionRank(normalizedUnit);
  const dtRank = getPrecisionRank(dt.precision.level);
  
  // Core decision: coerce if datetime precision is lower than quantity precision
  if (dtRank < quantityRank) {
    // Coercion path
    const coercedValue = convertAndTruncate(quantity, dt.precision.level);
    
    if (dt.precision.level === 'year') {
      return new FHIRDateTime(dt.year + coercedValue);
    } else if (dt.precision.level === 'month') {
      let newMonth = (dt.month || 1) + coercedValue;
      let newYear = dt.year;
      
      while (newMonth > 12) {
        newMonth -= 12;
        newYear += 1;
      }
      while (newMonth < 1) {
        newMonth += 12;
        newYear -= 1;
      }
      
      return new FHIRDateTime(newYear, newMonth);
    }
    // For higher precisions, continue to full arithmetic
  }
  
  // Full calendar/clock arithmetic path
  if (quantity.isCalendarUnit) {
    // Calendar arithmetic
    let year = dt.year;
    let month = dt.month || 1;
    let day = dt.day || 1;
    
    switch (normalizedUnit) {
      case 'year':
        year += Math.floor(quantity.value);
        break;
        
      case 'month':
        const totalMonths = month + Math.floor(quantity.value);
        year += Math.floor((totalMonths - 1) / 12);
        month = ((totalMonths - 1) % 12) + 1;
        if (month <= 0) {
          month += 12;
          year -= 1;
        }
        break;
        
      case 'week':
        // For weeks, truncate to integer weeks (FHIRPath behavior)
        // Use Math.trunc to truncate towards zero (not floor which rounds down)
        day += Math.trunc(quantity.value) * 7;
        break;
        
      case 'day':
        // For calendar days, truncate to integer (ignore decimal part)
        day += Math.trunc(quantity.value);
        break;
    }
    
    // Adjust for calendar validity
    const adjusted = adjustDateForValidity(year, month, day);
    
    // Handle day overflow into next month/year
    if (dt.precision.level === 'day' || dt.precision.level === 'hour' || 
        dt.precision.level === 'minute' || dt.precision.level === 'second' || 
        dt.precision.level === 'millisecond') {
      const jsDate = new Date(
        adjusted.year,
        adjusted.month - 1,
        adjusted.day,
        dt.hour || 0,
        dt.minute || 0,
        dt.second || 0,
        dt.millisecond || 0
      );
      
      return new FHIRDateTime(
        jsDate.getFullYear(),
        dt.month !== undefined ? jsDate.getMonth() + 1 : undefined,
        dt.day !== undefined ? jsDate.getDate() : undefined,
        dt.hour,
        dt.minute,
        dt.second,
        dt.millisecond,
        dt.timezoneOffset
      );
    }
    
    // Preserve precision
    return new FHIRDateTime(
      adjusted.year,
      dt.month !== undefined ? adjusted.month : undefined,
      dt.day !== undefined ? adjusted.day : undefined,
      dt.hour,
      dt.minute,
      dt.second,
      dt.millisecond,
      dt.timezoneOffset
    );
  } else {
    // Clock arithmetic for time units
    const jsDate = new Date(
      dt.year,
      (dt.month || 1) - 1,
      dt.day || 1,
      dt.hour || 0,
      dt.minute || 0,
      dt.second || 0,
      dt.millisecond || 0
    );
    
    switch (normalizedUnit) {
      case 'hour':
        jsDate.setHours(jsDate.getHours() + Math.floor(quantity.value));
        break;
      case 'minute':
        jsDate.setMinutes(jsDate.getMinutes() + Math.floor(quantity.value));
        break;
      case 'second':
        jsDate.setSeconds(jsDate.getSeconds() + Math.floor(quantity.value));
        break;
      case 'millisecond':
        jsDate.setMilliseconds(jsDate.getMilliseconds() + Math.floor(quantity.value));
        break;
    }
    
    return new FHIRDateTime(
      jsDate.getFullYear(),
      dt.month !== undefined ? jsDate.getMonth() + 1 : undefined,
      dt.day !== undefined ? jsDate.getDate() : undefined,
      dt.hour !== undefined ? jsDate.getHours() : undefined,
      dt.minute !== undefined ? jsDate.getMinutes() : undefined,
      dt.second !== undefined ? jsDate.getSeconds() : undefined,
      dt.millisecond !== undefined ? jsDate.getMilliseconds() : undefined,
      dt.timezoneOffset
    );
  }
}

/**
 * Subtract from DateTime with FHIRPath precision rules
 */
export function subtractFromDateTime(dt: FHIRDateTime, quantity: TimeQuantity): FHIRDateTime {
  // Negate the quantity and use addition
  const negatedQuantity: TimeQuantity = {
    value: -quantity.value,
    unit: quantity.unit,
    isCalendarUnit: quantity.isCalendarUnit,
  };
  return addToDateTime(dt, negatedQuantity);
}