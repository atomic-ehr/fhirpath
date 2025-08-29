import type { FunctionDefinition } from '../types';
import { Errors } from '../errors';
import { type FunctionEvaluator } from '../types';
import { unbox, box } from '../boxing';
import { createQuantity, CALENDAR_DURATION_UNITS } from '../quantity-value';
import { ucum } from '@atomic-ehr/ucum';

// Regex for parsing quantity strings according to FHIRPath spec
// Matches: (?'value'(\+|-)?\d+(\.\d+)?)\s*('(?'unit'[^']+)'|(?'time'[a-zA-Z]+))?
const QUANTITY_REGEX = /^(?<value>[+-]?\d+(?:\.\d+)?)\s*(?:'(?<quotedUnit>[^']+)'|(?<unquotedUnit>[a-zA-Z]+))?$/;

// Calendar duration conversion factors (from spec)
const CALENDAR_CONVERSIONS: Record<string, Record<string, number>> = {
  'year': { 'month': 12, 'months': 12, 'day': 365, 'days': 365, 'd': 365 },
  'years': { 'month': 12, 'months': 12, 'day': 365, 'days': 365, 'd': 365 },
  'month': { 'day': 30, 'days': 30, 'd': 30 },
  'months': { 'day': 30, 'days': 30, 'd': 30 },
  'week': { 'day': 7, 'days': 7, 'd': 7 },
  'weeks': { 'day': 7, 'days': 7, 'd': 7 },
  'wk': { 'day': 7, 'days': 7, 'd': 7 },
  'day': { 'hour': 24, 'hours': 24, 'h': 24 },
  'days': { 'hour': 24, 'hours': 24, 'h': 24 },
  'd': { 'hour': 24, 'hours': 24, 'h': 24 },
  'hour': { 'minute': 60, 'minutes': 60, 'min': 60 },
  'hours': { 'minute': 60, 'minutes': 60, 'min': 60 },
  'h': { 'minute': 60, 'minutes': 60, 'min': 60 },
  'minute': { 'second': 60, 'seconds': 60, 's': 60 },
  'minutes': { 'second': 60, 'seconds': 60, 's': 60 },
  'min': { 'second': 60, 'seconds': 60, 's': 60 },
  'second': { 's': 1 },
  'seconds': { 's': 1 }
};

// Map common time units to their canonical forms
const UNIT_MAPPING: Record<string, string> = {
  'year': 'year',
  'years': 'year',
  'month': 'month', 
  'months': 'month',
  'week': 'week',
  'weeks': 'week',
  'day': 'd',
  'days': 'd',
  'hour': 'h',
  'hours': 'h',
  'minute': 'min',
  'minutes': 'min',
  'second': 's',
  'seconds': 's',
  'millisecond': 'ms',
  'milliseconds': 'ms'
};

export const evaluate: FunctionEvaluator = async (input, context, args, evaluator) => {
  // toQuantity takes 0 or 1 argument (optional unit)
  if (args.length > 1) {
    throw Errors.wrongArgumentCountRange('toQuantity', 0, 1, args.length);
  }

  // Check singleton requirement
  if (input.length > 1) {
    throw Errors.singletonRequired('toQuantity', input.length);
  }

  if (input.length === 0) {
    return { value: [], context };
  }

  const item = input[0];
  if (!item) {
    return { value: [], context };
  }
  
  const unboxedItem = unbox(item);
  const itemType = (item as any).typeInfo?.type || (item as any).type;
  
  let resultQuantity: any = null;

  // Handle different input types
  if (itemType === 'Integer' || itemType === 'Decimal') {
    // Numbers get default unit '1'
    resultQuantity = createQuantity(unboxedItem as number, '1');
  } else if (itemType === 'Quantity') {
    // Already a quantity
    resultQuantity = unboxedItem;
  } else if (itemType === 'Boolean') {
    // true → 1.0 '1', false → 0.0 '1'
    const value = unboxedItem ? 1.0 : 0.0;
    resultQuantity = createQuantity(value, '1');
  } else if (itemType === 'String') {
    // Try to parse the string as a quantity
    const str = unboxedItem as string;
    const match = QUANTITY_REGEX.exec(str);
    
    if (match) {
      const value = parseFloat(match.groups?.value || '0');
      const unit = match.groups?.quotedUnit || match.groups?.unquotedUnit || '1';
      
      // Map common time units to canonical forms
      const mappedUnit = UNIT_MAPPING[unit] || unit;
      resultQuantity = createQuantity(value, mappedUnit);
    } else {
      // String doesn't match quantity format
      return { value: [], context };
    }
  } else {
    // Other types return empty
    return { value: [], context };
  }

  // If unit argument is provided, attempt conversion
  if (args.length === 1) {
    const unitArg = args[0];
    if (!unitArg) {
      throw Errors.invalidOperation('toQuantity: unit parameter is required');
    }
    
    // Evaluate the argument to get the unit string
    const unitResult = await evaluator(unitArg, input, context);
    if (unitResult.value.length !== 1) {
      throw Errors.invalidOperation('toQuantity: unit parameter must be a single string value');
    }
    
    const unitValue = unitResult.value[0];
    const unitValueType = (unitValue as any)?.typeInfo?.type || (unitValue as any)?.type;
    if (!unitValue || unitValueType !== 'String') {
      throw Errors.invalidOperation('toQuantity: unit parameter must be a string');
    }
    
    const targetUnit = unbox(unitValue) as string;
    const mappedTargetUnit = UNIT_MAPPING[targetUnit] || targetUnit;
    
    // Try calendar duration conversion first
    const conversions = CALENDAR_CONVERSIONS[resultQuantity.unit];
    if (conversions && conversions[mappedTargetUnit]) {
      const factor = conversions[mappedTargetUnit];
      resultQuantity = createQuantity(resultQuantity.value * factor, mappedTargetUnit);
    } else if (resultQuantity.unit === mappedTargetUnit) {
      // Same unit, no conversion needed
    } else if (!CALENDAR_DURATION_UNITS.has(resultQuantity.unit) && 
               !CALENDAR_DURATION_UNITS.has(mappedTargetUnit)) {
      // Try UCUM conversion
      try {
        const convertedValue = ucum.convert(resultQuantity.value, resultQuantity.unit, mappedTargetUnit);
        resultQuantity = createQuantity(convertedValue, mappedTargetUnit);
      } catch (e) {
        // Conversion failed, return empty
        return { value: [], context };
      }
    } else {
      // Can't convert between these units
      return { value: [], context };
    }
  }

  return { 
    value: [box(resultQuantity, { type: 'Quantity', singleton: true })], 
    context 
  };
};

export const toQuantityFunction: FunctionDefinition & { evaluate: FunctionEvaluator } = {
  name: 'toQuantity',
  category: ['conversion'],
  description: 'Converts the input to a Quantity value. Integers and Decimals are converted with default unit \'1\'. Strings are parsed for quantity format. Boolean true becomes 1.0 \'1\', false becomes 0.0 \'1\'. With optional unit parameter, attempts conversion to specified unit.',
  examples: [
    '1.toQuantity() // Returns 1 \'1\'',
    '\'4 days\'.toQuantity() // Returns 4 \'d\'',
    '\'1 \\\'wk\\\'\'.toQuantity(\'d\') // Returns 7 \'d\'',
    'true.toQuantity() // Returns 1.0 \'1\''
  ],
  signatures: [{
    name: 'toQuantity',
    input: { type: 'Any', singleton: true },
    parameters: [
      { name: 'unit', type: { type: 'String', singleton: true }, optional: true }
    ],
    result: { type: 'Quantity', singleton: true }
  }],
  evaluate
};