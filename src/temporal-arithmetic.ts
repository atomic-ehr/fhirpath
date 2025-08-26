// FHIRPath Temporal Arithmetic Implementation
// Following ADR-017: The "Coerce or Calendar" Algorithm

import type { 
  FHIRDate, 
  FHIRDateTime, 
  FHIRTime, 
  TimeQuantity, 
  TimeUnit,
  PrecisionInfo 
} from './temporal';

// ============================================================================
// Precision Ranking for Coercion Decision
// ============================================================================

const PRECISION_RANK: Record<string, number> = {
  year: 1,
  month: 2,
  day: 3,
  hour: 4,
  minute: 5,
  second: 6,
  millisecond: 7
};

const UNIT_RANK: Record<TimeUnit, number> = {
  year: 1,
  month: 2,
  week: 3,
  day: 3,  // Week and day have same rank
  hour: 4,
  minute: 5,
  second: 6,
  millisecond: 7
};

// ============================================================================
// Core Decision: Coerce or Calendar?
// ============================================================================

function needsCoercion(precision: PrecisionInfo, unit: TimeUnit): boolean {
  const precisionRank = PRECISION_RANK[precision.level];
  const unitRank = UNIT_RANK[unit];
  return precisionRank !== undefined && precisionRank < unitRank;
}

// ============================================================================
// Conversion Factors for Coercion
// ============================================================================

const CONVERSION_FACTORS = {
  // Calendar conversions (fixed ratios per spec)
  monthsPerYear: 12,
  daysPerMonth: 30,    // Fixed by spec for conversion
  daysPerYear: 365,    // Fixed by spec for conversion
  daysPerWeek: 7,
  
  // Clock conversions (exact)
  hoursPerDay: 24,
  minutesPerHour: 60,
  secondsPerMinute: 60,
  millisecondsPerSecond: 1000
};

// ============================================================================
// Coercion Functions (with truncation)
// ============================================================================

interface CoercedQuantity {
  value: number;
  unit: TimeUnit;
}

function coerceQuantity(quantity: TimeQuantity, targetPrecision: PrecisionInfo): CoercedQuantity {
  const { value, unit } = quantity;
  const target = targetPrecision.level;
  
  // Convert to target precision level and truncate
  if (target === 'year') {
    switch (unit) {
      case 'year':
        return { value: Math.trunc(value), unit: 'year' };
      case 'month':
        return { value: Math.trunc(value / CONVERSION_FACTORS.monthsPerYear), unit: 'year' };
      case 'week':
        const days = value * CONVERSION_FACTORS.daysPerWeek;
        return { value: Math.trunc(days / CONVERSION_FACTORS.daysPerYear), unit: 'year' };
      case 'day':
        return { value: Math.trunc(value / CONVERSION_FACTORS.daysPerYear), unit: 'year' };
      case 'hour':
        const daysFromHours = value / CONVERSION_FACTORS.hoursPerDay;
        return { value: Math.trunc(daysFromHours / CONVERSION_FACTORS.daysPerYear), unit: 'year' };
      case 'minute':
        const daysFromMinutes = value / (CONVERSION_FACTORS.minutesPerHour * CONVERSION_FACTORS.hoursPerDay);
        return { value: Math.trunc(daysFromMinutes / CONVERSION_FACTORS.daysPerYear), unit: 'year' };
      case 'second':
        const daysFromSeconds = value / (CONVERSION_FACTORS.secondsPerMinute * CONVERSION_FACTORS.minutesPerHour * CONVERSION_FACTORS.hoursPerDay);
        return { value: Math.trunc(daysFromSeconds / CONVERSION_FACTORS.daysPerYear), unit: 'year' };
      case 'millisecond':
        const daysFromMs = value / (CONVERSION_FACTORS.millisecondsPerSecond * CONVERSION_FACTORS.secondsPerMinute * CONVERSION_FACTORS.minutesPerHour * CONVERSION_FACTORS.hoursPerDay);
        return { value: Math.trunc(daysFromMs / CONVERSION_FACTORS.daysPerYear), unit: 'year' };
    }
  }
  
  if (target === 'month') {
    switch (unit) {
      case 'year':
        return { value: value * CONVERSION_FACTORS.monthsPerYear, unit: 'month' };
      case 'month':
        return { value: Math.trunc(value), unit: 'month' };
      case 'week':
        const days = value * CONVERSION_FACTORS.daysPerWeek;
        return { value: Math.trunc(days / CONVERSION_FACTORS.daysPerMonth), unit: 'month' };
      case 'day':
        return { value: Math.trunc(value / CONVERSION_FACTORS.daysPerMonth), unit: 'month' };
      case 'hour':
        const daysFromHours = value / CONVERSION_FACTORS.hoursPerDay;
        return { value: Math.trunc(daysFromHours / CONVERSION_FACTORS.daysPerMonth), unit: 'month' };
      case 'minute':
        const daysFromMinutes = value / (CONVERSION_FACTORS.minutesPerHour * CONVERSION_FACTORS.hoursPerDay);
        return { value: Math.trunc(daysFromMinutes / CONVERSION_FACTORS.daysPerMonth), unit: 'month' };
      case 'second':
        const daysFromSeconds = value / (CONVERSION_FACTORS.secondsPerMinute * CONVERSION_FACTORS.minutesPerHour * CONVERSION_FACTORS.hoursPerDay);
        return { value: Math.trunc(daysFromSeconds / CONVERSION_FACTORS.daysPerMonth), unit: 'month' };
      case 'millisecond':
        const daysFromMs = value / (CONVERSION_FACTORS.millisecondsPerSecond * CONVERSION_FACTORS.secondsPerMinute * CONVERSION_FACTORS.minutesPerHour * CONVERSION_FACTORS.hoursPerDay);
        return { value: Math.trunc(daysFromMs / CONVERSION_FACTORS.daysPerMonth), unit: 'month' };
    }
  }
  
  if (target === 'day') {
    // Day precision doesn't coerce - uses calendar arithmetic
    return { value, unit };
  }
  
  // For Time types
  if (target === 'hour') {
    switch (unit) {
      case 'hour':
        return { value: Math.trunc(value), unit: 'hour' };
      case 'minute':
        return { value: Math.trunc(value / CONVERSION_FACTORS.minutesPerHour), unit: 'hour' };
      case 'second':
        return { value: Math.trunc(value / (CONVERSION_FACTORS.secondsPerMinute * CONVERSION_FACTORS.minutesPerHour)), unit: 'hour' };
      case 'millisecond':
        return { value: Math.trunc(value / (CONVERSION_FACTORS.millisecondsPerSecond * CONVERSION_FACTORS.secondsPerMinute * CONVERSION_FACTORS.minutesPerHour)), unit: 'hour' };
      default:
        // Calendar units not allowed for Time
        throw new Error(`Cannot add ${unit} to Time value`);
    }
  }
  
  if (target === 'minute') {
    switch (unit) {
      case 'hour':
        return { value: value * CONVERSION_FACTORS.minutesPerHour, unit: 'minute' };
      case 'minute':
        return { value: Math.trunc(value), unit: 'minute' };
      case 'second':
        return { value: Math.trunc(value / CONVERSION_FACTORS.secondsPerMinute), unit: 'minute' };
      case 'millisecond':
        return { value: Math.trunc(value / (CONVERSION_FACTORS.millisecondsPerSecond * CONVERSION_FACTORS.secondsPerMinute)), unit: 'minute' };
      default:
        throw new Error(`Cannot add ${unit} to Time value`);
    }
  }
  
  // Second and millisecond precision don't coerce
  return { value, unit };
}

// ============================================================================
// Calendar Helper Functions
// ============================================================================

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

function getDaysInMonth(year: number, month: number): number {
  const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  
  if (month === 2 && isLeapYear(year)) {
    return 29;
  }
  
  return daysPerMonth[month - 1] ?? 31;
}

function normalizeDate(year: number, month: number, day: number): { year: number; month: number; day: number } {
  // Normalize month overflow/underflow
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  
  // Adjust day to be valid for the month
  const maxDay = getDaysInMonth(year, month);
  if (day > maxDay) {
    day = maxDay;  // Cap at last day of month (month-end semantics)
  }
  if (day < 1) {
    day = 1;
  }
  
  return { year, month, day };
}

// ============================================================================
// Calendar Arithmetic Implementation
// ============================================================================

interface DateComponents {
  year: number;
  month?: number;
  day?: number;
}

function addCalendarUnits(date: DateComponents, quantity: TimeQuantity, isSubtraction: boolean = false): DateComponents {
  const sign = isSubtraction ? -1 : 1;
  let { year, month, day } = date;
  const { value: rawValue, unit } = quantity;
  const value = rawValue * sign;
  
  switch (unit) {
    case 'year':
      year += Math.trunc(value);
      // Clamp year to valid range
      if (year < 1) year = 1;
      if (year > 9999) year = 9999;
      // Handle month-end for leap year transitions
      if (month !== undefined && day !== undefined) {
        const normalized = normalizeDate(year, month, day);
        return normalized;
      }
      return { year, month, day };
      
    case 'month':
      if (month === undefined) {
        // Should not happen if we're using calendar arithmetic
        throw new Error('Cannot add months to year-only date using calendar arithmetic');
      }
      
      // Add months with proper year overflow
      // Convert to absolute month count from year 1
      const currentAbsoluteMonths = year * 12 + month;
      const newAbsoluteMonths = currentAbsoluteMonths + Math.trunc(value);
      
      // Convert back to year and month
      if (newAbsoluteMonths <= 0) {
        // Handle negative months (before year 1)
        year = 1;
        month = 1;
      } else {
        year = Math.floor((newAbsoluteMonths - 1) / 12);
        month = ((newAbsoluteMonths - 1) % 12) + 1;
        // Clamp year to valid range
        if (year < 1) year = 1;
        if (year > 9999) year = 9999;
      }
      
      // Handle month-end semantics
      if (day !== undefined) {
        const normalized = normalizeDate(year, month, day);
        return normalized;
      }
      return { year, month, day };
      
    case 'week':
      // Convert weeks to days
      return addCalendarUnits(date, { value: value * 7, unit: 'day', isCalendarUnit: true }, false);
      
    case 'day':
      if (day === undefined) {
        // Should not happen if we're using calendar arithmetic  
        throw new Error('Cannot add days to date without day component using calendar arithmetic');
      }
      
      // Add days with proper month/year overflow
      let tempDay = day + Math.trunc(value);
      let tempMonth = month ?? 1;
      let tempYear = year;
      
      // Handle overflow
      while (tempDay > getDaysInMonth(tempYear, tempMonth)) {
        tempDay -= getDaysInMonth(tempYear, tempMonth);
        tempMonth++;
        if (tempMonth > 12) {
          tempMonth = 1;
          tempYear++;
        }
      }
      
      // Handle underflow
      while (tempDay < 1) {
        tempMonth--;
        if (tempMonth < 1) {
          tempMonth = 12;
          tempYear--;
        }
        tempDay += getDaysInMonth(tempYear, tempMonth);
      }
      
      // Clamp year to valid range
      if (tempYear < 1) {
        tempYear = 1;
        tempMonth = 1;
        tempDay = 1;
      } else if (tempYear > 9999) {
        tempYear = 9999;
        tempMonth = 12;
        tempDay = 31;
      }
      
      return { year: tempYear, month: tempMonth, day: tempDay };
      
    default:
      // Hours, minutes, seconds, milliseconds need DateTime
      throw new Error(`Cannot add ${unit} to Date value`);
  }
}

// ============================================================================
// Clock Arithmetic Implementation
// ============================================================================

interface TimeComponents {
  hour: number;
  minute?: number;
  second?: number;
  millisecond?: number;
}

function addClockUnits(time: TimeComponents, quantity: TimeQuantity, isSubtraction: boolean = false): TimeComponents {
  const sign = isSubtraction ? -1 : 1;
  const { value: rawValue, unit } = quantity;
  const value = rawValue * sign;
  
  // Convert everything to milliseconds for calculation
  let totalMs = time.hour * 60 * 60 * 1000;
  if (time.minute !== undefined) {
    totalMs += time.minute * 60 * 1000;
  }
  if (time.second !== undefined) {
    totalMs += time.second * 1000;
  }
  if (time.millisecond !== undefined) {
    totalMs += time.millisecond;
  }
  
  // Add the quantity
  switch (unit) {
    case 'hour':
      totalMs += value * 60 * 60 * 1000;
      break;
    case 'minute':
      totalMs += value * 60 * 1000;
      break;
    case 'second':
      totalMs += value * 1000;
      break;
    case 'millisecond':
      totalMs += value;
      break;
    default:
      throw new Error(`Cannot add ${unit} to Time value`);
  }
  
  // Wrap at 24 hours (86400000 ms)
  const msPerDay = 24 * 60 * 60 * 1000;
  totalMs = totalMs % msPerDay;
  if (totalMs < 0) {
    totalMs += msPerDay;
  }
  
  // Extract components based on original precision
  const hour = Math.floor(totalMs / (60 * 60 * 1000));
  totalMs %= 60 * 60 * 1000;
  
  let minute: number | undefined;
  let second: number | undefined;
  let millisecond: number | undefined;
  
  if (time.minute !== undefined) {
    minute = Math.floor(totalMs / (60 * 1000));
    totalMs %= 60 * 1000;
  }
  
  if (time.second !== undefined) {
    second = Math.floor(totalMs / 1000);
    totalMs %= 1000;
  }
  
  if (time.millisecond !== undefined) {
    millisecond = Math.floor(totalMs);
  }
  
  return { hour, minute, second, millisecond };
}

// ============================================================================
// DateTime Arithmetic (combines calendar and clock)
// ============================================================================

interface DateTimeComponents {
  year: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  second?: number;
  millisecond?: number;
  timezoneOffset?: number;
}

function addDateTimeComponents(dt: DateTimeComponents, quantity: TimeQuantity, isSubtraction: boolean = false): DateTimeComponents {
  const { unit } = quantity;
  
  // Calendar units
  if (unit === 'year' || unit === 'month' || unit === 'week' || unit === 'day') {
    const dateResult = addCalendarUnits(
      { year: dt.year, month: dt.month, day: dt.day },
      quantity,
      isSubtraction
    );
    
    // For day units with time components, handle day overflow from hours
    if (unit === 'day' && dt.hour !== undefined) {
      // Days are added as calendar days, not 24-hour periods
      return {
        ...dateResult,
        hour: dt.hour,
        minute: dt.minute,
        second: dt.second,
        millisecond: dt.millisecond,
        timezoneOffset: dt.timezoneOffset
      };
    }
    
    return {
      ...dateResult,
      hour: dt.hour,
      minute: dt.minute,
      second: dt.second,
      millisecond: dt.millisecond,
      timezoneOffset: dt.timezoneOffset
    };
  }
  
  // Clock units
  if (dt.hour !== undefined) {
    // Can add clock units
    const timeResult = addClockUnits(
      {
        hour: dt.hour,
        minute: dt.minute,
        second: dt.second,
        millisecond: dt.millisecond
      },
      quantity,
      isSubtraction
    );
    
    // Check for day overflow by calculating total time before and after
    let dayOffset = 0;
    
    // Calculate original total minutes from start of day
    const originalTotalMinutes = dt.hour * 60 + (dt.minute ?? 0);
    const newTotalMinutes = timeResult.hour * 60 + (timeResult.minute ?? 0);
    
    // Detect day boundary crossing
    const sign = isSubtraction ? -1 : 1;
    if (quantity.unit === 'hour' || quantity.unit === 'minute') {
      const totalMinutesAdded = 
        quantity.unit === 'hour' ? quantity.value * 60 * sign :
        quantity.value * sign;
      const expectedMinutes = originalTotalMinutes + totalMinutesAdded;
      dayOffset = Math.floor(expectedMinutes / (24 * 60));
    } else if (quantity.unit === 'second' || quantity.unit === 'millisecond') {
      const originalSeconds = originalTotalMinutes * 60 + (dt.second ?? 0);
      const newSeconds = newTotalMinutes * 60 + (timeResult.second ?? 0);
      const totalSecondsAdded = 
        quantity.unit === 'second' ? quantity.value * sign :
        quantity.value * sign / 1000;
      const expectedSeconds = originalSeconds + totalSecondsAdded;
      dayOffset = Math.floor(expectedSeconds / (24 * 60 * 60));
    }
    
    // Apply day offset if needed
    if (dayOffset !== 0 && dt.day !== undefined) {
      const dateWithOffset = addCalendarUnits(
        { year: dt.year, month: dt.month, day: dt.day },
        { value: dayOffset, unit: 'day', isCalendarUnit: true },
        false
      );
      
      return {
        ...dateWithOffset,
        hour: timeResult.hour,
        minute: timeResult.minute,
        second: timeResult.second,
        millisecond: timeResult.millisecond,
        timezoneOffset: dt.timezoneOffset
      };
    }
    
    return {
      year: dt.year,
      month: dt.month,
      day: dt.day,
      hour: timeResult.hour,
      minute: timeResult.minute,
      second: timeResult.second,
      millisecond: timeResult.millisecond,
      timezoneOffset: dt.timezoneOffset
    };
  }
  
  // No time components - should have used calendar arithmetic
  throw new Error(`Cannot add ${unit} to DateTime without time components`);
}

// ============================================================================
// Main Exported Arithmetic Functions
// ============================================================================

export function addToDate(date: FHIRDate, quantity: TimeQuantity): FHIRDate {
  const FHIRDate = require('./temporal').FHIRDate;
  
  // The ONE QUESTION: Coerce or Calendar?
  if (needsCoercion(date.precision, quantity.unit)) {
    // Path A: Coerce and truncate
    const coerced = coerceQuantity(quantity, date.precision);
    
    // Simple addition based on precision
    if (date.precision.level === 'year') {
      let newYear = date.year + coerced.value;
      if (newYear < 1) newYear = 1;
      if (newYear > 9999) newYear = 9999;
      return new FHIRDate(newYear);
    } else if (date.precision.level === 'month') {
      // Coerced value is in months
      const totalMonths = (date.month ?? 1) + coerced.value;
      const yearsToAdd = Math.floor((totalMonths - 1) / 12);
      const newMonth = ((totalMonths - 1) % 12) + 1;
      return new FHIRDate(date.year + yearsToAdd, newMonth);
    }
    // Day precision shouldn't coerce
    throw new Error('Unexpected coercion for day precision');
    
  } else {
    // Path B: Calendar arithmetic
    const result = addCalendarUnits(
      { year: date.year, month: date.month, day: date.day },
      quantity,
      false
    );
    
    return new FHIRDate(result.year, result.month, result.day);
  }
}

export function subtractFromDate(date: FHIRDate, quantity: TimeQuantity): FHIRDate {
  const FHIRDate = require('./temporal').FHIRDate;
  
  // The ONE QUESTION: Coerce or Calendar?
  if (needsCoercion(date.precision, quantity.unit)) {
    // Path A: Coerce and truncate
    const coerced = coerceQuantity(quantity, date.precision);
    
    // Simple subtraction based on precision
    if (date.precision.level === 'year') {
      let newYear = date.year - coerced.value;
      if (newYear < 1) newYear = 1;
      if (newYear > 9999) newYear = 9999;
      return new FHIRDate(newYear);
    } else if (date.precision.level === 'month') {
      // Coerced value is in months - do simple subtraction
      // 2020-02 = year 2020, month 2 = 2020*12 + 2 = 24242 total months
      // subtract 3 = 24239 months
      // 24239 / 12 = 2019.916... year 2019 
      // 24239 % 12 = 11, so month 11
      const totalMonths = date.year * 12 + (date.month ?? 1) - coerced.value;
      
      if (totalMonths <= 0) {
        // Handle going before year 1
        return new FHIRDate(1, 1);
      }
      
      // Calculate year and month from total months
      // We need to be careful: month 1 = January, not month 0
      const newYear = Math.floor((totalMonths - 1) / 12); 
      const newMonth = ((totalMonths - 1) % 12) + 1;
      
      return new FHIRDate(newYear < 1 ? 1 : newYear, newMonth);
    }
    throw new Error('Unexpected coercion for day precision');
    
  } else {
    // Path B: Calendar arithmetic
    const result = addCalendarUnits(
      { year: date.year, month: date.month, day: date.day },
      quantity,
      true  // isSubtraction
    );
    
    return new FHIRDate(result.year, result.month, result.day);
  }
}

export function addToTime(time: FHIRTime, quantity: TimeQuantity): FHIRTime {
  const FHIRTime = require('./temporal').FHIRTime;
  
  // Check that quantity is a clock unit
  if (quantity.isCalendarUnit) {
    throw new Error(`Cannot add calendar unit ${quantity.unit} to Time value`);
  }
  
  // The ONE QUESTION: Coerce or Clock?
  if (needsCoercion(time.precision, quantity.unit)) {
    // Path A: Coerce and truncate
    const coerced = coerceQuantity(quantity, time.precision);
    
    // Simple addition based on precision
    if (time.precision.level === 'hour') {
      let newHour = time.hour + coerced.value;
      // Wrap at 24 hours
      newHour = newHour % 24;
      if (newHour < 0) newHour += 24;
      return new FHIRTime(newHour);
    } else if (time.precision.level === 'minute') {
      const totalMinutes = (time.hour * 60 + (time.minute ?? 0)) + coerced.value;
      const hours = Math.floor(totalMinutes / 60) % 24;
      const minutes = totalMinutes % 60;
      return new FHIRTime(hours < 0 ? hours + 24 : hours, minutes < 0 ? minutes + 60 : minutes);
    }
    // Second/millisecond precision shouldn't coerce
    
  }
  
  // Path B: Clock arithmetic
  const result = addClockUnits(
    {
      hour: time.hour,
      minute: time.minute,
      second: time.second,
      millisecond: time.millisecond
    },
    quantity,
    false
  );
  
  return new FHIRTime(result.hour, result.minute, result.second, result.millisecond);
}

export function subtractFromTime(time: FHIRTime, quantity: TimeQuantity): FHIRTime {
  const FHIRTime = require('./temporal').FHIRTime;
  
  // Check that quantity is a clock unit
  if (quantity.isCalendarUnit) {
    throw new Error(`Cannot subtract calendar unit ${quantity.unit} from Time value`);
  }
  
  // The ONE QUESTION: Coerce or Clock?
  if (needsCoercion(time.precision, quantity.unit)) {
    // Path A: Coerce and truncate
    const coerced = coerceQuantity(quantity, time.precision);
    
    // Simple subtraction based on precision
    if (time.precision.level === 'hour') {
      let newHour = time.hour - coerced.value;
      // Wrap at 24 hours
      newHour = newHour % 24;
      if (newHour < 0) newHour += 24;
      return new FHIRTime(newHour);
    } else if (time.precision.level === 'minute') {
      const totalMinutes = (time.hour * 60 + (time.minute ?? 0)) - coerced.value;
      let hours = Math.floor(totalMinutes / 60) % 24;
      let minutes = totalMinutes % 60;
      if (minutes < 0) {
        minutes += 60;
        hours -= 1;
      }
      if (hours < 0) hours += 24;
      return new FHIRTime(hours, minutes);
    }
  }
  
  // Path B: Clock arithmetic
  const result = addClockUnits(
    {
      hour: time.hour,
      minute: time.minute,
      second: time.second,
      millisecond: time.millisecond
    },
    quantity,
    true  // isSubtraction
  );
  
  return new FHIRTime(result.hour, result.minute, result.second, result.millisecond);
}

export function addToDateTime(dt: FHIRDateTime, quantity: TimeQuantity): FHIRDateTime {
  const FHIRDateTime = require('./temporal').FHIRDateTime;
  
  // The ONE QUESTION: Coerce or Calendar/Clock?
  if (needsCoercion(dt.precision, quantity.unit)) {
    // Path A: Coerce and truncate
    const coerced = coerceQuantity(quantity, dt.precision);
    
    // Apply based on precision level
    if (dt.precision.level === 'year') {
      return new FHIRDateTime(dt.year + coerced.value);
    } else if (dt.precision.level === 'month') {
      const totalMonths = (dt.month ?? 1) + coerced.value;
      const yearsToAdd = Math.floor((totalMonths - 1) / 12);
      const newMonth = ((totalMonths - 1) % 12) + 1;
      return new FHIRDateTime(dt.year + yearsToAdd, newMonth);
    }
    // Other precisions use calendar/clock arithmetic
  }
  
  // Path B: Calendar/Clock arithmetic
  const result = addDateTimeComponents(
    {
      year: dt.year,
      month: dt.month,
      day: dt.day,
      hour: dt.hour,
      minute: dt.minute,
      second: dt.second,
      millisecond: dt.millisecond,
      timezoneOffset: dt.timezoneOffset
    },
    quantity,
    false
  );
  
  return new FHIRDateTime(
    result.year,
    result.month,
    result.day,
    result.hour,
    result.minute,
    result.second,
    result.millisecond,
    result.timezoneOffset
  );
}

export function subtractFromDateTime(dt: FHIRDateTime, quantity: TimeQuantity): FHIRDateTime {
  const FHIRDateTime = require('./temporal').FHIRDateTime;
  
  // The ONE QUESTION: Coerce or Calendar/Clock?
  if (needsCoercion(dt.precision, quantity.unit)) {
    // Path A: Coerce and truncate
    const coerced = coerceQuantity(quantity, dt.precision);
    
    // Apply based on precision level
    if (dt.precision.level === 'year') {
      return new FHIRDateTime(dt.year - coerced.value);
    } else if (dt.precision.level === 'month') {
      const totalMonths = (dt.month ?? 1) - coerced.value;
      let newMonth = totalMonths;
      let newYear = dt.year;
      
      if (totalMonths < 1) {
        const yearsBack = Math.ceil(Math.abs(totalMonths - 1) / 12);
        newYear -= yearsBack;
        newMonth = 12 - (Math.abs(totalMonths - 1) % 12);
        if (newMonth === 0) newMonth = 12;
      }
      
      return new FHIRDateTime(newYear, newMonth);
    }
  }
  
  // Path B: Calendar/Clock arithmetic
  const result = addDateTimeComponents(
    {
      year: dt.year,
      month: dt.month,
      day: dt.day,
      hour: dt.hour,
      minute: dt.minute,
      second: dt.second,
      millisecond: dt.millisecond,
      timezoneOffset: dt.timezoneOffset
    },
    quantity,
    true  // isSubtraction
  );
  
  return new FHIRDateTime(
    result.year,
    result.month,
    result.day,
    result.hour,
    result.minute,
    result.second,
    result.millisecond,
    result.timezoneOffset
  );
}