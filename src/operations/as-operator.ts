import type { OperatorDefinition } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { box, unbox } from '../boxing';

export const evaluate: OperationEvaluator = async (input, context, left, right) => {
  // 'as' operator performs type casting/filtering
  // Returns items that match the type, empty if no match
  if (left.length === 0) {
    return { value: [], context };
  }
  
  const results: any[] = [];
  const typeName = right[0] as string; // Should be a type name
  
  for (const boxedItem of left) {
    const item = unbox(boxedItem);
    let matches = false;
    
    // Check typeInfo first if available
    if (boxedItem?.typeInfo) {
      // If we have a ModelProvider, use it for accurate type checking (handles subtypes)
      if (context.modelProvider) {
        const matchingType = context.modelProvider.ofType(boxedItem.typeInfo, typeName as any);
        matches = matchingType !== undefined;
      } else {
        // Without ModelProvider, just check exact match
        matches = boxedItem.typeInfo.type === typeName;
      }
    } else {
      // Fallback to primitive type checking
      switch (typeName) {
        case 'String':
          matches = typeof item === 'string';
          break;
        case 'Boolean':
          matches = typeof item === 'boolean';
          break;
        case 'Integer':
          matches = typeof item === 'number' && Number.isInteger(item);
          break;
        case 'Decimal':
          matches = typeof item === 'number';
          break;
        case 'Date':
          // Check if it's a FHIRDate instance or has Date typeInfo
          if (item && typeof item === 'object') {
            const { FHIRDate } = require('../temporal');
            matches = item instanceof FHIRDate || (item as any).type === 'Date';
          }
          break;
        case 'DateTime':
          // Check if it's a FHIRDateTime instance or has DateTime typeInfo
          if (item && typeof item === 'object') {
            const { FHIRDateTime } = require('../temporal');
            matches = item instanceof FHIRDateTime || (item as any).type === 'DateTime';
          }
          break;
        case 'Time':
          // Check if it's a FHIRTime instance or has Time typeInfo
          if (item && typeof item === 'object') {
            const { FHIRTime } = require('../temporal');
            matches = item instanceof FHIRTime || (item as any).type === 'Time';
          }
          break;
        default:
          // For complex types, check resourceType
          if (item && typeof item === 'object' && 'resourceType' in item) {
            matches = item.resourceType === typeName;
          }
      }
    }
    
    if (matches) {
      results.push(boxedItem);
    }
  }
  
  return { value: results, context };
};

export const asOperator: OperatorDefinition & { evaluate: OperationEvaluator } = {
  symbol: 'as',
  name: 'as',
  category: ['type'],
  precedence: PRECEDENCE.AS_IS,
  associativity: 'left',
  description: 'Type cast operator',
  examples: ['value as String'],
  signatures: [],
  evaluate
};