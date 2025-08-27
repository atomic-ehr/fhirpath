import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { subtractQuantities } from '../quantity-value';
import type { QuantityValue } from '../quantity-value';
import { box, unbox } from '../boxing';

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
    const { createTimeQuantity } = await import('../temporal');
    
    // Check if it's a time unit
    const timeUnits = ['year', 'years', 'month', 'months', 'week', 'weeks', 
                      'day', 'days', 'hour', 'hours', 'minute', 'minutes', 
                      'second', 'seconds', 'millisecond', 'milliseconds',
                      's', 'min', 'h', 'd', 'wk', 'mo', 'a', 'ms'];
    
    // Map short units to full names
    const unitMap: Record<string, string> = {
      's': 'second',
      'min': 'minute',
      'h': 'hour',
      'd': 'day',
      'wk': 'week',
      'mo': 'month',
      'a': 'year',
      'ms': 'millisecond'
    };
    
    const mappedUnit = unitMap[quantity.unit] || quantity.unit;
    
    if (!timeUnits.includes(quantity.unit)) {
      throw new Error(`Cannot subtract quantity with unit '${quantity.unit}' from temporal value`);
    }
    
    const timeQuantity = createTimeQuantity(quantity.value, mappedUnit as any);
    
    let result;
    if (temporalType === 'Date') {
      const { FHIRDate } = await import('../temporal');
      if (!(l instanceof FHIRDate)) {
        const date = Object.setPrototypeOf(l, FHIRDate.prototype);
        result = date.subtract(timeQuantity);
      } else {
        result = l.subtract(timeQuantity);
      }
      return { value: [box(result, { type: 'Date', singleton: true })], context };
    } else if (temporalType === 'DateTime') {
      const { FHIRDateTime } = await import('../temporal');
      if (!(l instanceof FHIRDateTime)) {
        const dateTime = Object.setPrototypeOf(l, FHIRDateTime.prototype);
        result = dateTime.subtract(timeQuantity);
      } else {
        result = l.subtract(timeQuantity);
      }
      return { value: [box(result, { type: 'DateTime', singleton: true })], context };
    } else if (temporalType === 'Time') {
      const { FHIRTime } = await import('../temporal');
      if (!(l instanceof FHIRTime)) {
        const time = Object.setPrototypeOf(l, FHIRTime.prototype);
        result = time.subtract(timeQuantity);
      } else {
        result = l.subtract(timeQuantity);
      }
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