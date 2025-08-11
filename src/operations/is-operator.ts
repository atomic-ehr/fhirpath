import type { OperatorDefinition, TypeName } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: OperationEvaluator = async (input, context, left, right) => {
  // Right operand should be a type identifier
  // Empty collection returns empty (not false)
  if (left.length === 0) {
    return { value: [], context };
  }
  
  const boxedItem = left[0];
  const item = unbox(boxedItem);
  const typeName = right[0] as string; // Should be a type name like 'String', 'Integer', etc.
  
  // If we have a ModelProvider in context, use it for accurate type checking
  if (context.modelProvider && boxedItem?.typeInfo) {
    const matchingType = context.modelProvider.ofType(boxedItem.typeInfo, typeName as TypeName);
    return { 
      value: [box(matchingType !== undefined, { type: 'Boolean', singleton: true })], 
      context 
    };
  }
  
  // Check if the box has type information
  if (boxedItem?.typeInfo) {
    // For now, just check exact type match (no subtype support without ModelProvider)
    return { 
      value: [box(boxedItem.typeInfo.type === typeName, { type: 'Boolean', singleton: true })], 
      context 
    };
  }
  
  // For FHIR resources without typeInfo, try to get it from modelProvider
  if (context.modelProvider && item && typeof item === 'object' && 'resourceType' in item && typeof item.resourceType === 'string') {
    // Use cached type if available
    const typeInfo = 'getTypeFromCache' in context.modelProvider 
      ? (context.modelProvider as any).getTypeFromCache(item.resourceType)
      : undefined;
    if (typeInfo) {
      const matchingType = context.modelProvider.ofType(typeInfo, typeName as TypeName);
      return { 
        value: [box(matchingType !== undefined, { type: 'Boolean', singleton: true })], 
        context 
      };
    }
    // If we can't get type info, fall back to exact resourceType match
    return { 
      value: [box(item.resourceType === typeName, { type: 'Boolean', singleton: true })], 
      context 
    };
  }
  
  // Check primitive types
  switch (typeName) {
    case 'String':
      return { value: [box(typeof item === 'string', { type: 'Boolean', singleton: true })], context };
    case 'Boolean':
      return { value: [box(typeof item === 'boolean', { type: 'Boolean', singleton: true })], context };
    case 'Integer':
      return { value: [box(typeof item === 'number' && Number.isInteger(item), { type: 'Boolean', singleton: true })], context };
    case 'Decimal':
      return { value: [box(typeof item === 'number', { type: 'Boolean', singleton: true })], context };
    case 'Date':
    case 'DateTime':
    case 'Time':
      // Simple check for date-like strings
      return { value: [box(typeof item === 'string' && !isNaN(Date.parse(item)), { type: 'Boolean', singleton: true })], context };
    default:
      // For complex types, check resourceType
      if (item && typeof item === 'object' && 'resourceType' in item) {
        return { value: [box(item.resourceType === typeName, { type: 'Boolean', singleton: true })], context };
      }
      return { value: [box(false, { type: 'Boolean', singleton: true })], context };
  }
};

export const isOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: 'is',
  name: 'is',
  category: ['type'],
  precedence: PRECEDENCE.AS_IS,
  associativity: 'left',
  description: 'Type test operator',
  examples: ['value is String'],
  signatures: [],
  evaluate
};

// TypeInfo unionType of all attribute types on current level:
// gender: {type: code}
// 
// children() -> 