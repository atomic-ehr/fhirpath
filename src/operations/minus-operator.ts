import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { subtractQuantities } from '../complex-types/quantity-value';
import type { QuantityValue } from '../complex-types/quantity-value';
import { box, unbox } from '../interpreter/boxing';

export const evaluate: OperationEvaluator = async (input, context, left, right) => {
  if (left.length === 0 || right.length === 0) {
    return { value: [], context };
  }
  
  const boxedl = left[0];
  if (!boxedl) return { value: [], context };
  const l = unbox(boxedl);
  const boxedr = right[0];
  if (!boxedr) return { value: [], context };
  const r = unbox(boxedr);
  
  // Check for temporal arithmetic using boxed type information
  const leftType = boxedl?.typeInfo?.type;
  const rightType = boxedr?.typeInfo?.type;
  
  if ((leftType === 'Date' || leftType === 'DateTime' || leftType === 'Time') && rightType === 'Quantity') {
    // Left is temporal, right is quantity
    const temporalType = leftType;
    const quantity = r as QuantityValue;
    
    // Import temporal utilities and create TimeQuantity
    const { createTimeQuantity, subtract } = await import('../complex-types/temporal');
    
    // Calendar duration units (allowed for temporal arithmetic)
    const calendarUnits = ['year', 'years', 'month', 'months', 'week', 'weeks', 
                          'day', 'days', 'hour', 'hours', 'minute', 'minutes', 
                          'second', 'seconds', 'millisecond', 'milliseconds'];
    
    // Variable duration UCUM units (not allowed for temporal arithmetic - they have calendar-dependent durations)
    const variableDurationUnits = ['a', 'mo'];
    
    // Fixed duration UCUM units (allowed - they map directly to calendar units)
    const fixedDurationUnitMap: Record<string, string> = {
      'd': 'day',
      'wk': 'week', 
      'h': 'hour',
      'min': 'minute',
      's': 'second',
      'ms': 'millisecond'
    };
    
    // Check if this is a variable duration unit (not allowed)
    if (variableDurationUnits.includes(quantity.unit)) {
      // Variable duration units like 'a' and 'mo' cannot be subtracted from temporal values
      // because they don't have fixed durations
      const { Errors } = await import('../errors');
      throw Errors.invalidTemporalUnit(temporalType, quantity.unit);
    }
    
    // Map fixed duration UCUM units to calendar units
    let mappedUnit = fixedDurationUnitMap[quantity.unit] || quantity.unit;
    
    // Check if this is a valid calendar duration unit (after mapping)
    if (!calendarUnits.includes(mappedUnit)) {
      // Non-time units with temporal values return empty per FHIRPath spec
      return { value: [], context };
    }
    
    const timeQuantity = createTimeQuantity(quantity.value, mappedUnit as any);
    
    // Use the functional subtract operation
    const result = subtract(l as any, timeQuantity);
    
    if (temporalType === 'Date') {
      return { value: [box(result, { type: 'Date', singleton: true })], context };
    } else if (temporalType === 'DateTime') {
      return { value: [box(result, { type: 'DateTime', singleton: true })], context };
    } else if (temporalType === 'Time') {
      return { value: [box(result, { type: 'Time', singleton: true })], context };
    }
  }
  
  // Check if both are quantities
  if (l && typeof l === 'object' && 'unit' in l && 
      r && typeof r === 'object' && 'unit' in r) {
    const result = subtractQuantities(l as QuantityValue, r as QuantityValue);
    return { value: result ? [box(result, { type: 'Quantity', singleton: true })] : [], context };
  }
  
  // Handle numeric subtraction
  if (typeof l === 'number' && typeof r === 'number') {
    const result = l - r;
    const typeInfo = Number.isInteger(result) ? 
      { type: 'Integer' as const, singleton: true } : 
      { type: 'Decimal' as const, singleton: true };
    return { value: [box(result, typeInfo)], context };
  }
  
  // For other types, return empty
  return { value: [], context };
};

export const minusOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '-',
  name: 'minus',
  category: ['arithmetic'],
  precedence: PRECEDENCE.ADDITIVE,
  associativity: 'left',
  description: 'Subtracts the right operand from the left operand (supported for Integer, Decimal, and Quantity). For Date/DateTime/Time, decrements by time-valued quantity.',
  examples: ['5 - 3', '10.5 - 2.5', '3 \'m\' - 3 \'cm\'', '@2019-03-01 - 24 months'],
  signatures: [
    {
      name: 'integer-minus',
      left: { type: 'Integer', singleton: true },
      right: { type: 'Integer', singleton: true },
      result: { type: 'Integer', singleton: true },
    },
    {
      name: 'decimal-minus',
      left: { type: 'Decimal', singleton: true },
      right: { type: 'Decimal', singleton: true },
      result: { type: 'Decimal', singleton: true },
    },
    {
      name: 'quantity-minus',
      left: { type: 'Quantity', singleton: true },
      right: { type: 'Quantity', singleton: true },
      result: { type: 'Quantity', singleton: true },
    },
    {
      name: 'date-minus',
      left: { type: 'Date', singleton: true },
      right: { type: 'Quantity', singleton: true },
      result: { type: 'Date', singleton: true },
    },
    {
      name: 'datetime-minus',
      left: { type: 'DateTime', singleton: true },
      right: { type: 'Quantity', singleton: true },
      result: { type: 'DateTime', singleton: true },
    },
    {
      name: 'time-minus',
      left: { type: 'Time', singleton: true },
      right: { type: 'Quantity', singleton: true },
      result: { type: 'Time', singleton: true },
    }
  ],
  evaluate
};