import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { addQuantities } from '../complex-types/quantity-value';
import type { QuantityValue } from '../complex-types/quantity-value';
import { box, unbox } from '../interpreter/boxing';

export const evaluate: OperationEvaluator = async (input, context, left, right) => {
  if (left.length === 0 || right.length === 0) {
    return { value: [], context };
  }
  
  const boxedL = left[0];
  const boxedR = right[0];
  
  if (!boxedL || !boxedR) {
    return { value: [], context };
  }
  
  const l = unbox(boxedL);
  const r = unbox(boxedR);
  
  // Check for temporal arithmetic using boxed type information
  const leftType = boxedL?.typeInfo?.type;
  const rightType = boxedR?.typeInfo?.type;
  
  if ((leftType === 'Date' || leftType === 'DateTime' || leftType === 'Time') && rightType === 'Quantity') {
    // Left is temporal, right is quantity
    const temporalType = leftType;
    const temporal = l;
    const quantity = r as QuantityValue;
    
    // Import temporal utilities and create TimeQuantity
    const { createTimeQuantity, add } = await import('../complex-types/temporal');
    
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
      // Variable duration units like 'a' and 'mo' cannot be added to temporal values
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
    
    // Use the functional add operation
    const result = add(temporal as any, timeQuantity);
    
    if (temporalType === 'Date') {
      return { value: [box(result, { type: 'Date', singleton: true })], context };
    } else if (temporalType === 'DateTime') {
      return { value: [box(result, { type: 'DateTime', singleton: true })], context };
    } else if (temporalType === 'Time') {
      // Let the error propagate - adding calendar units to Time should throw
      return { value: [box(result, { type: 'Time', singleton: true })], context };
    }
  }
  
  // Check if both are quantities
  if (l && typeof l === 'object' && 'unit' in l && 
      r && typeof r === 'object' && 'unit' in r) {
    const result = addQuantities(l as QuantityValue, r as QuantityValue);
    return { value: result ? [box(result, { type: 'Quantity', singleton: true })] : [], context };
  }
  
  // String concatenation only works for string + string
  if (typeof l === 'string' && typeof r === 'string') {
    return { value: [box(l + r, { type: 'String', singleton: true })], context };
  }
  
  if (typeof l === 'number' && typeof r === 'number') {
    const result = l + r;
    const typeInfo = Number.isInteger(result) ? 
      { type: 'Integer' as const, singleton: true } : 
      { type: 'Decimal' as const, singleton: true };
    return { value: [box(result, typeInfo)], context };
  }
  
  // For incompatible types, return empty per FHIRPath spec
  return { value: [], context };
};

export const plusOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: '+',
  name: 'plus',
  category: ['arithmetic'],
  precedence: PRECEDENCE.ADDITIVE,
  associativity: 'left',
  description: 'For Integer, Decimal, and Quantity, adds the operands. For strings, concatenates the right operand to the left operand. For Date/DateTime/Time, increments by time-valued quantity.',
  examples: ['2 + 3', '"Hello" + " " + "World"', '@2018-03-01 + 1 day', '3 \'m\' + 3 \'cm\''],
  signatures: [
    {
      name: 'integer-plus',
      left: { type: 'Integer', singleton: true },
      right: { type: 'Integer', singleton: true },
      result: { type: 'Integer', singleton: true },
    },
    {
      name: 'decimal-plus',
      left: { type: 'Decimal', singleton: true },
      right: { type: 'Decimal', singleton: true },
      result: { type: 'Decimal', singleton: true },
    },
    {
      name: 'string-plus',
      left: { type: 'String', singleton: true },
      right: { type: 'String', singleton: true },
      result: { type: 'String', singleton: true },
    },
    {
      name: 'quantity-plus',
      left: { type: 'Quantity', singleton: true },
      right: { type: 'Quantity', singleton: true },
      result: { type: 'Quantity', singleton: true },
    },
    {
      name: 'date-plus',
      left: { type: 'Date', singleton: true },
      right: { type: 'Quantity', singleton: true },
      result: { type: 'Date', singleton: true },
    },
    {
      name: 'datetime-plus',
      left: { type: 'DateTime', singleton: true },
      right: { type: 'Quantity', singleton: true },
      result: { type: 'DateTime', singleton: true },
    },
    {
      name: 'time-plus',
      left: { type: 'Time', singleton: true },
      right: { type: 'Quantity', singleton: true },
      result: { type: 'Time', singleton: true },
    }
  ],
  evaluate
};