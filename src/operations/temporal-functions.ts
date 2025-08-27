// Built-in temporal functions for FHIRPath
import type { FunctionDefinition } from '../types';
import type { FunctionEvaluator } from '../types';
import { box } from '../boxing';
import { createDate, createDateTime, createTime, isFHIRDate, isFHIRDateTime, isFHIRTime } from '../temporal';

// ============================================================================
// now() function - Returns current DateTime
// ============================================================================

export const nowEvaluator: FunctionEvaluator = async (input, context, args) => {
  const now = new Date();
  const dateTime = createDateTime(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
    -now.getTimezoneOffset() // Convert to minutes from UTC (JS gives minutes to subtract from UTC)
  );
  
  return {
    value: [box(dateTime, { type: 'DateTime', singleton: true })],
    context
  };
};

export const nowFunction: FunctionDefinition & { evaluate: typeof nowEvaluator } = {
  name: 'now',
  category: ['temporal'],
  description: 'Returns the current date and time as a DateTime value',
  examples: ['now()', 'Patient.birthDate < now()'],
  signatures: [
    {
      name: 'now',
      input: { type: 'Any', singleton: false },
      parameters: [],
      result: { type: 'DateTime', singleton: true }
    }
  ],
  evaluate: nowEvaluator
};

// ============================================================================
// today() function - Returns current Date
// ============================================================================

export const todayEvaluator: FunctionEvaluator = async (input, context, args) => {
  const today = new Date();
  const date = createDate(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate()
  );
  
  return {
    value: [box(date, { type: 'Date', singleton: true })],
    context
  };
};

export const todayFunction: FunctionDefinition & { evaluate: typeof todayEvaluator } = {
  name: 'today',
  category: ['temporal'],
  description: 'Returns the current date (no time component)',
  examples: ['today()', 'Patient.birthDate < today()'],
  signatures: [
    {
      name: 'today',
      input: { type: 'Any', singleton: false },
      parameters: [],
      result: { type: 'Date', singleton: true }
    }
  ],
  evaluate: todayEvaluator
};

// ============================================================================
// timeOfDay() function - Returns current Time
// ============================================================================

export const timeOfDayEvaluator: FunctionEvaluator = async (input, context, args) => {
  const now = new Date();
  const time = createTime(
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds()
  );
  
  return {
    value: [box(time, { type: 'Time', singleton: true })],
    context
  };
};

export const timeOfDayFunction: FunctionDefinition & { evaluate: typeof timeOfDayEvaluator } = {
  name: 'timeOfDay',
  category: ['temporal'],
  description: 'Returns the current time of day',
  examples: ['timeOfDay()', '@T09:00 < timeOfDay()'],
  signatures: [
    {
      name: 'timeOfDay',
      input: { type: 'Any', singleton: false },
      parameters: [],
      result: { type: 'Time', singleton: true }
    }
  ],
  evaluate: timeOfDayEvaluator
};

// ============================================================================
// toDate() function - Convert to Date
// ============================================================================

export const toDateEvaluator: FunctionEvaluator = async (input, context, args) => {
  if (input.length === 0) {
    return { value: [], context };
  }
  
  const boxedItem = input[0];
  if (!boxedItem) {
    return { value: [], context };
  }
  
  const item = boxedItem.value;
  const typeInfo = boxedItem.typeInfo;
  
  // If it's already a Date, return as is
  if (typeInfo?.type === 'Date') {
    return { value: [boxedItem], context };
  }
  
  // If it's a DateTime, extract the date portion
  if (typeInfo?.type === 'DateTime' && item && typeof item === 'object') {
    const dateTime = item as any;
    const date = createDate(dateTime.year, dateTime.month, dateTime.day);
    return {
      value: [box(date, { type: 'Date', singleton: true })],
      context
    };
  }
  
  // If it's a String, try to parse it
  if (typeof item === 'string') {
    try {
      const { parseTemporalLiteral, isFHIRDate } = await import('../temporal');
      const temporal = parseTemporalLiteral('@' + item);
      if (isFHIRDate(temporal)) {
        return {
          value: [box(temporal, { type: 'Date', singleton: true })],
          context
        };
      }
    } catch {
      // Parsing failed, return empty
    }
  }
  
  // For any other type (including Boolean), return empty
  // This allows expressions like ({}).empty().toDate() to return []
  return { value: [], context };
};

export const toDateFunction: FunctionDefinition & { evaluate: typeof toDateEvaluator } = {
  name: 'toDate',
  category: ['conversion', 'temporal'],
  description: 'Converts the input to a Date value',
  examples: ["'2020-01-15'.toDate()", '@2020-01-15T10:30:00.toDate()'],
  signatures: [
    {
      name: 'any-toDate',
      parameters: [],
      input: { type: 'Any', singleton: true },
      result: { type: 'Date', singleton: false }
    }
  ],
  evaluate: toDateEvaluator
};

// ============================================================================
// toDateTime() function - Convert to DateTime
// ============================================================================

export const toDateTimeEvaluator: FunctionEvaluator = async (input, context, args) => {
  if (input.length === 0) {
    return { value: [], context };
  }
  
  const boxedItem = input[0];
  if (!boxedItem) {
    return { value: [], context };
  }
  
  const item = boxedItem.value;
  const typeInfo = boxedItem.typeInfo;
  
  // If it's already a DateTime, return as is
  if (typeInfo?.type === 'DateTime') {
    return { value: [boxedItem], context };
  }
  
  // If it's a Date, convert to DateTime with time as 00:00:00
  if (typeInfo?.type === 'Date' && item && typeof item === 'object') {
    const date = item as any;
    const dateTime = createDateTime(
      date.year,
      date.month,
      date.day,
      0, 0, 0, 0
    );
    return {
      value: [box(dateTime, { type: 'DateTime', singleton: true })],
      context
    };
  }
  
  // If it's a String, try to parse it
  if (typeof item === 'string') {
    try {
      const { parseTemporalLiteral, isFHIRDate, isFHIRDateTime } = await import('../temporal');
      const temporal = parseTemporalLiteral('@' + item);
      if (isFHIRDateTime(temporal)) {
        return {
          value: [box(temporal, { type: 'DateTime', singleton: true })],
          context
        };
      } else if (isFHIRDate(temporal)) {
        // Convert Date to DateTime (with time as 00:00:00)
        const dateTime = createDateTime(
          temporal.year,
          temporal.month,
          temporal.day,
          0, 0, 0, 0
        );
        return {
          value: [box(dateTime, { type: 'DateTime', singleton: true })],
          context
        };
      }
    } catch {
      // Parsing failed, return empty
    }
  }
  
  // For any other type (including Boolean), return empty
  // This allows expressions like ({}).empty().toDateTime() to return []
  return { value: [], context };
};

export const toDateTimeFunction: FunctionDefinition & { evaluate: typeof toDateTimeEvaluator } = {
  name: 'toDateTime',
  category: ['conversion', 'temporal'],
  description: 'Converts the input to a DateTime value',
  examples: ["'2020-01-15T10:30:00Z'.toDateTime()", '@2020-01-15.toDateTime()'],
  signatures: [
    {
      name: 'any-toDateTime',
      parameters: [],
      input: { type: 'Any', singleton: true },
      result: { type: 'DateTime', singleton: false }
    }
  ],
  evaluate: toDateTimeEvaluator
};

// ============================================================================
// toTime() function - Convert to Time
// ============================================================================

export const toTimeEvaluator: FunctionEvaluator = async (input, context, args) => {
  if (input.length === 0) {
    return { value: [], context };
  }
  
  const boxedItem = input[0];
  if (!boxedItem) {
    return { value: [], context };
  }
  
  const item = boxedItem.value;
  const typeInfo = boxedItem.typeInfo;
  
  // If it's already a Time, return as is
  if (typeInfo?.type === 'Time') {
    return { value: [boxedItem], context };
  }
  
  // If it's a DateTime, extract the time portion
  if (typeInfo?.type === 'DateTime' && item && typeof item === 'object') {
    const dateTime = item as any;
    if (dateTime.hour !== undefined) {
      const time = createTime(dateTime.hour, dateTime.minute, dateTime.second, dateTime.millisecond);
      return {
        value: [box(time, { type: 'Time', singleton: true })],
        context
      };
    }
  }
  
  // If it's a String, try to parse it
  if (typeof item === 'string') {
    try {
      const { parseTemporalLiteral, isFHIRTime } = await import('../temporal');
      // For time strings, prepend T if not present
      const timeString = item.startsWith('T') ? '@' + item : '@T' + item;
      const temporal = parseTemporalLiteral(timeString);
      if (isFHIRTime(temporal)) {
        return {
          value: [box(temporal, { type: 'Time', singleton: true })],
          context
        };
      }
    } catch {
      // Parsing failed, return empty
    }
  }
  
  // For any other type (including Boolean), return empty
  // This allows expressions like ({}).empty().toTime() to return []
  return { value: [], context };
};

export const toTimeFunction: FunctionDefinition & { evaluate: typeof toTimeEvaluator } = {
  name: 'toTime',
  category: ['conversion', 'temporal'],
  description: 'Converts the input to a Time value',
  examples: ["'14:30:00'.toTime()", '@2020-01-15T10:30:00.toTime()'],
  signatures: [
    {
      name: 'any-toTime',
      parameters: [],
      input: { type: 'Any', singleton: true },
      result: { type: 'Time', singleton: false }
    }
  ],
  evaluate: toTimeEvaluator
};

// ============================================================================
// convertsToDate() function - Check if convertible to Date
// ============================================================================

export const convertsToDateEvaluator: FunctionEvaluator = async (input, context, args) => {
  if (input.length === 0) {
    return { value: [], context };
  }
  
  const boxedItem = input[0];
  if (!boxedItem) {
    return { value: [box(false, { type: 'Boolean', singleton: true })], context };
  }
  
  const item = boxedItem.value;
  const typeInfo = boxedItem.typeInfo;
  
  // Already a Date
  if (typeInfo?.type === 'Date') {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }
  
  // DateTime can be converted
  if (typeInfo?.type === 'DateTime') {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }
  
  // Try to parse string
  if (typeof item === 'string') {
    try {
      const { parseTemporalLiteral, isFHIRDate } = await import('../temporal');
      const temporal = parseTemporalLiteral('@' + item);
      return {
        value: [box(isFHIRDate(temporal), { type: 'Boolean', singleton: true })],
        context
      };
    } catch {
      return { value: [box(false, { type: 'Boolean', singleton: true })], context };
    }
  }
  
  return { value: [box(false, { type: 'Boolean', singleton: true })], context };
};

export const convertsToDateFunction: FunctionDefinition & { evaluate: typeof convertsToDateEvaluator } = {
  name: 'convertsToDate',
  category: ['conversion', 'temporal'],
  description: 'Returns true if the input can be converted to a Date',
  examples: ["'2020-01-15'.convertsToDate()", "'invalid'.convertsToDate()"],
  signatures: [
    {
      name: 'convertsToDate',
      parameters: [],
      input: { type: 'Any', singleton: true },
      result: { type: 'Boolean', singleton: true }
    }
  ],
  evaluate: convertsToDateEvaluator
};

// ============================================================================
// convertsToDateTime() function - Check if convertible to DateTime
// ============================================================================

export const convertsToDateTimeEvaluator: FunctionEvaluator = async (input, context, args) => {
  if (input.length === 0) {
    return { value: [], context };
  }
  
  const boxedItem = input[0];
  if (!boxedItem) {
    return { value: [box(false, { type: 'Boolean', singleton: true })], context };
  }
  
  const item = boxedItem.value;
  const typeInfo = boxedItem.typeInfo;
  
  // Already a DateTime
  if (typeInfo?.type === 'DateTime') {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }
  
  // Date can be converted
  if (typeInfo?.type === 'Date') {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }
  
  // Try to parse string
  if (typeof item === 'string') {
    try {
      const { parseTemporalLiteral, isFHIRDate, isFHIRDateTime } = await import('../temporal');
      const temporal = parseTemporalLiteral('@' + item);
      return {
        value: [box(isFHIRDateTime(temporal) || isFHIRDate(temporal), { type: 'Boolean', singleton: true })],
        context
      };
    } catch {
      return { value: [box(false, { type: 'Boolean', singleton: true })], context };
    }
  }
  
  return { value: [box(false, { type: 'Boolean', singleton: true })], context };
};

export const convertsToDateTimeFunction: FunctionDefinition & { evaluate: typeof convertsToDateTimeEvaluator } = {
  name: 'convertsToDateTime',
  category: ['conversion', 'temporal'],
  description: 'Returns true if the input can be converted to a DateTime',
  examples: ["'2020-01-15T10:30:00'.convertsToDateTime()", "'invalid'.convertsToDateTime()"],
  signatures: [
    {
      name: 'convertsToDateTime',
      parameters: [],
      input: { type: 'Any', singleton: true },
      result: { type: 'Boolean', singleton: true }
    }
  ],
  evaluate: convertsToDateTimeEvaluator
};

// ============================================================================
// convertsToTime() function - Check if convertible to Time
// ============================================================================

export const convertsToTimeEvaluator: FunctionEvaluator = async (input, context, args) => {
  if (input.length === 0) {
    return { value: [], context };
  }
  
  const boxedItem = input[0];
  if (!boxedItem) {
    return { value: [box(false, { type: 'Boolean', singleton: true })], context };
  }
  
  const item = boxedItem.value;
  const typeInfo = boxedItem.typeInfo;
  
  // Already a Time
  if (typeInfo?.type === 'Time') {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }
  
  // DateTime can be converted if it has time components
  if (typeInfo?.type === 'DateTime') {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }
  
  // Try to parse string
  if (typeof item === 'string') {
    try {
      const { parseTemporalLiteral, isFHIRTime } = await import('../temporal');
      const timeString = item.startsWith('T') ? '@' + item : '@T' + item;
      const temporal = parseTemporalLiteral(timeString);
      return {
        value: [box(isFHIRTime(temporal), { type: 'Boolean', singleton: true })],
        context
      };
    } catch {
      return { value: [box(false, { type: 'Boolean', singleton: true })], context };
    }
  }
  
  return { value: [box(false, { type: 'Boolean', singleton: true })], context };
};

export const convertsToTimeFunction: FunctionDefinition & { evaluate: typeof convertsToTimeEvaluator } = {
  name: 'convertsToTime',
  category: ['conversion', 'temporal'],
  description: 'Returns true if the input can be converted to a Time',
  examples: ["'14:30:00'.convertsToTime()", "'invalid'.convertsToTime()"],
  signatures: [
    {
      name: 'convertsToTime',
      parameters: [],
      input: { type: 'Any', singleton: true },
      result: { type: 'Boolean', singleton: true }
    }
  ],
  evaluate: convertsToTimeEvaluator
};