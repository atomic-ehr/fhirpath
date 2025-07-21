import { FunctionRegistry } from './registry';
import { CollectionUtils, EvaluationError } from '../types';

// Type conversion functions

// Standalone function implementations
export const toStringFn = (interpreter: any, context: any, input: any[]) => {
  if (input.length === 0) {
    return { value: [], context };
  }
  
  const value = CollectionUtils.toSingleton(input);
  
  if (value === null || value === undefined) {
    return { value: [], context };
  }
  
  // Handle different types
  if (typeof value === 'boolean') {
    return { value: [value ? 'true' : 'false'], context };
  }
  
  return { value: [String(value)], context };
};

export const toIntegerFn = (interpreter: any, context: any, input: any[]) => {
  if (input.length === 0) {
    return { value: [], context };
  }
  
  const value = CollectionUtils.toSingleton(input);
  
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { value: [value], context };
    }
    // Truncate decimal numbers
    return { value: [Math.trunc(value)], context };
  }
  
  if (typeof value === 'string') {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      return { value: [num], context };
    }
  }
  
  return { value: [], context };
};

export const toDecimalFn = (interpreter: any, context: any, input: any[]) => {
  if (input.length === 0) {
    return { value: [], context };
  }
  
  const value = CollectionUtils.toSingleton(input);
  
  if (typeof value === 'number') {
    return { value: [value], context };
  }
  
  if (typeof value === 'string') {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      return { value: [num], context };
    }
  }
  
  return { value: [], context };
};

export const toBooleanFn = (interpreter: any, context: any, input: any[]) => {
  if (input.length === 0) {
    return { value: [], context };
  }
  
  const value = CollectionUtils.toSingleton(input);
  
  if (typeof value === 'boolean') {
    return { value: [value], context };
  }
  
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === 't' || lower === 'yes' || lower === 'y' || lower === '1') {
      return { value: [true], context };
    }
    if (lower === 'false' || lower === 'f' || lower === 'no' || lower === 'n' || lower === '0') {
      return { value: [false], context };
    }
  }
  
  if (typeof value === 'number') {
    if (value === 1) return { value: [true], context };
    if (value === 0) return { value: [false], context };
  }
  
  return { value: [], context };
};

export const toDateFn = (interpreter: any, context: any, input: any[]) => {
  if (input.length === 0) {
    return { value: [], context };
  }
  
  const value = CollectionUtils.toSingleton(input);
  
  if (typeof value === 'string') {
    // Basic date validation - expects YYYY-MM-DD format
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (datePattern.test(value)) {
      const date = new Date(value + 'T00:00:00');
      if (!isNaN(date.getTime())) {
        return { value: [value], context };
      }
    }
  }
  
  return { value: [], context };
};

export const toDateTimeFn = (interpreter: any, context: any, input: any[]) => {
  if (input.length === 0) {
    return { value: [], context };
  }
  
  const value = CollectionUtils.toSingleton(input);
  
  if (typeof value === 'string') {
    // Try to parse as ISO 8601 datetime
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return { value: [value], context };
    }
  }
  
  return { value: [], context };
};

export const toTimeFn = (interpreter: any, context: any, input: any[]) => {
  if (input.length === 0) {
    return { value: [], context };
  }
  
  const value = CollectionUtils.toSingleton(input);
  
  if (typeof value === 'string') {
    // Basic time validation - expects HH:MM:SS format
    const timePattern = /^\d{2}:\d{2}:\d{2}$/;
    if (timePattern.test(value)) {
      return { value: [value], context };
    }
  }
  
  return { value: [], context };
};

export const toQuantityFn = (interpreter: any, context: any, input: any[], unit?: string) => {
  if (input.length === 0) {
    return { value: [], context };
  }
  
  const value = CollectionUtils.toSingleton(input);
  
  if (typeof value === 'number') {
    const quantity = {
      value: value,
      unit: unit || '1',
      system: 'http://unitsofmeasure.org',
      code: unit || '1'
    };
    return { value: [quantity], context };
  }
  
  if (typeof value === 'string') {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      const quantity = {
        value: num,
        unit: unit || '1',
        system: 'http://unitsofmeasure.org',
        code: unit || '1'
      };
      return { value: [quantity], context };
    }
  }
  
  return { value: [], context };
};

// Register functions with new signature

// toString() - convert to string
FunctionRegistry.register({
  name: 'toString',
  propagateEmptyInput: true,
  evaluate: toStringFn
});

// toInteger() - convert to integer
FunctionRegistry.register({
  name: 'toInteger',
  propagateEmptyInput: true,
  evaluate: toIntegerFn
});

// toDecimal() - convert to decimal
FunctionRegistry.register({
  name: 'toDecimal',
  propagateEmptyInput: true,
  evaluate: toDecimalFn
});

// toBoolean() - convert to boolean
FunctionRegistry.register({
  name: 'toBoolean',
  propagateEmptyInput: true,
  evaluate: toBooleanFn
});

// toDate() - convert to date
FunctionRegistry.register({
  name: 'toDate',
  propagateEmptyInput: true,
  evaluate: toDateFn
});

// toDateTime() - convert to datetime
FunctionRegistry.register({
  name: 'toDateTime',
  propagateEmptyInput: true,
  evaluate: toDateTimeFn
});

// toTime() - convert to time
FunctionRegistry.register({
  name: 'toTime',
  propagateEmptyInput: true,
  evaluate: toTimeFn
});

// toQuantity([unit]) - convert to quantity
FunctionRegistry.register({
  name: 'toQuantity',
  propagateEmptyInput: true,
  arguments: [{
    name: 'unit',
    type: 'string',
    optional: true
  }],
  evaluate: toQuantityFn
});