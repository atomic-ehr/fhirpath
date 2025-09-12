import type { FunctionDefinition, FunctionEvaluator } from '../types';
import { Errors } from '../errors';
import { box, unbox } from '../interpreter/boxing';
import { createQuantity, isValidQuantity } from '../complex-types/quantity-value';

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // convertsToQuantity() takes no arguments
  if (args.length !== 0) {
    throw Errors.wrongArgumentCount('convertsToQuantity', 0, args.length);
  }

  // If input collection is empty, result is empty
  if (input.length === 0) {
    return { value: [], context };
  }

  // If input collection contains multiple items, signal an error
  if (input.length > 1) {
    throw Errors.singletonRequired('convertsToQuantity', input.length);
  }

  const boxedInputValue = input[0];
  if (!boxedInputValue) {
    return { value: [box(false, { type: 'Boolean', singleton: true })], context };
  }
  
  const inputValue = unbox(boxedInputValue);
  const typeInfo = boxedInputValue.typeInfo;

  // Check if the value can be converted to Quantity
  
  // Already a Quantity
  if (typeInfo?.type === 'Quantity') {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }
  
  // Check for Quantity object structure
  if (inputValue && typeof inputValue === 'object') {
    const obj = inputValue as any;
    // Check if it looks like a Quantity (has value and unit properties)
    if (typeof obj.value === 'number' && typeof obj.unit === 'string') {
      // Validate that the unit is valid (either UCUM or calendar duration)
      try {
        const quantity = createQuantity(obj.value, obj.unit);
        const isValid = isValidQuantity(quantity);
        return { value: [box(isValid, { type: 'Boolean', singleton: true })], context };
      } catch {
        return { value: [box(false, { type: 'Boolean', singleton: true })], context };
      }
    }
  }
  
  // String - check if it can be parsed as a quantity or plain number
  if (typeof inputValue === 'string') {
    const trimmed = inputValue.trim();
    
    // First check if it's just a plain number (integer or decimal)
    const numberRegex = /^(\+|-)?\d+(\.\d+)?$/;
    if (numberRegex.test(trimmed)) {
      const value = parseFloat(trimmed);
      if (!isNaN(value)) {
        // Plain number strings can be converted to quantity with unit '1'
        return { value: [box(true, { type: 'Boolean', singleton: true })], context };
      }
    }
    
    // Try to parse as quantity: number followed by space(s) and unit
    // This matches the pattern: <number> <unit> or <number> '<unit>'
    const quantityRegex = /^(\+|-)?\d+(\.\d+)?\s+.+$/;
    
    if (!quantityRegex.test(trimmed)) {
      return { value: [box(false, { type: 'Boolean', singleton: true })], context };
    }
    
    // Split into value and unit parts
    const parts = inputValue.trim().split(/\s+/);
    if (parts.length < 2) {
      return { value: [box(false, { type: 'Boolean', singleton: true })], context };
    }
    
    const valueStr = parts[0];
    let unit = parts.slice(1).join(' ');
    
    // Check if unit is quoted
    const isQuoted = unit.startsWith("'") && unit.endsWith("'") && unit.length > 2;
    
    if (isQuoted) {
      // Remove quotes for validation
      unit = unit.slice(1, -1);
    } else {
      // For unquoted units, check special cases
      // Calendar duration words are always valid
      const CALENDAR_DURATION_WORDS = [
        'year', 'years',
        'month', 'months', 
        'week', 'weeks',
        'day', 'days',
        'hour', 'hours',
        'minute', 'minutes',
        'second', 'seconds',
        'millisecond', 'milliseconds'
      ];
      
      // Time unit abbreviations that should NOT be accepted without quotes
      // (they have calendar duration equivalents)
      const TIME_UNIT_ABBREVS = ['wk', 'd', 'h', 'min', 's', 'ms'];
      
      if (TIME_UNIT_ABBREVS.includes(unit)) {
        // These time abbreviations require quotes
        return { value: [box(false, { type: 'Boolean', singleton: true })], context };
      }
      
      // Calendar duration words are valid
      // Other units (like mg, km, etc.) are also valid
    }
    
    const value = parseFloat(valueStr!);
    if (isNaN(value)) {
      return { value: [box(false, { type: 'Boolean', singleton: true })], context };
    }
    
    // Check if the unit is valid
    try {
      const quantity = createQuantity(value, unit);
      const isValid = isValidQuantity(quantity);
      return { value: [box(isValid, { type: 'Boolean', singleton: true })], context };
    } catch {
      return { value: [box(false, { type: 'Boolean', singleton: true })], context };
    }
  }
  
  // Integer or Decimal - can be converted to quantity with unit '1'
  if (typeof inputValue === 'number') {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }
  
  // Boolean - can be converted to quantity (1 or 0 with unit '1')
  if (typeof inputValue === 'boolean') {
    return { value: [box(true, { type: 'Boolean', singleton: true })], context };
  }

  // For all other types, return false
  return { value: [box(false, { type: 'Boolean', singleton: true })], context };
};

export const convertsToQuantityFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'convertsToQuantity',
  category: ['type-conversion'],
  description: 'Returns true if the input can be converted to a Quantity. Returns true for: Quantity (any), String in format "number unit" with valid UCUM or calendar duration unit. Returns false for numbers without units and all other types.',
  examples: [
    "'10 mg'.convertsToQuantity()",
    "'5.5 km'.convertsToQuantity()",
    "10.convertsToQuantity()",
    "'invalid'.convertsToQuantity()"
  ],
  signatures: [
    {
      name: 'convertsToQuantity',
      input: { type: 'Any', singleton: true },
      parameters: [],
      result: { type: 'Boolean', singleton: true }
    }
  ],
  evaluate
};