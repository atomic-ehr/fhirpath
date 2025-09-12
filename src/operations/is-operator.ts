import type { OperatorDefinition, TypeName } from '../types';
import { PRECEDENCE } from '../types';
import type { OperationEvaluator } from '../types';
import { box, unbox } from '../interpreter/boxing';
import { isFHIRDate, isFHIRDateTime, isFHIRTime } from '../complex-types/temporal';

export const evaluate: OperationEvaluator = async (input, context, left, right) => {
  // Right operand should be a type identifier
  // Empty collection returns empty (not false)
  if (left.length === 0) {
    return { value: [], context };
  }
  
  const boxedItem = left[0];
  const item = unbox(boxedItem);
  const typeName = right[0] as string; // Should be a type name like 'String', 'Integer', etc.
  // If we have a ModelProvider and typeInfo, use it for accurate type checking (handles subtypes)
  if (context.modelProvider && boxedItem?.typeInfo) {
    // Check for namespace-qualified types (e.g., System.Boolean, FHIR.boolean)
    let checkNamespace: string | undefined;
    let checkType: string;
    
    if (typeName.includes('.')) {
      const parts = typeName.split('.');
      checkNamespace = parts[0];
      checkType = parts.slice(1).join('.');
    } else {
      checkType = typeName;
    }
    
    // If checking for System type, ensure it's NOT a FHIR type
    if (checkNamespace === 'System') {
      // System types should not match FHIR types
      if (boxedItem.typeInfo.namespace === 'FHIR') {
        return { 
          value: [box(false, { type: 'Boolean', singleton: true })], 
          context 
        };
      }
      // Check if the type matches (without namespace)
      const normalizedType = checkType;
      if (boxedItem.typeInfo.type === normalizedType) {
        return { 
          value: [box(true, { type: 'Boolean', singleton: true })], 
          context 
        };
      }
    }
    
    // If checking for FHIR type
    if (checkNamespace === 'FHIR') {
      // Must be a FHIR namespaced type
      if (boxedItem.typeInfo.namespace === 'FHIR') {
        // Check the name field for FHIR types (e.g., 'boolean', 'integer')
        if (boxedItem.typeInfo.name === checkType) {
          return { 
            value: [box(true, { type: 'Boolean', singleton: true })], 
            context 
          };
        }
        
        // Check type hierarchy using schema if available
        if (context.modelProvider && boxedItem.typeInfo.name) {
          // Check if the item's type is derived from the check type
          const itemSchema = await (context.modelProvider as any).getSchema(boxedItem.typeInfo.name);
          if (itemSchema && itemSchema.base) {
            // Extract the type name from the base URL
            const baseTypeName = itemSchema.base.split('/').pop();
            if (baseTypeName === checkType) {
              return { 
                value: [box(true, { type: 'Boolean', singleton: true })], 
                context 
              };
            }
            // Check recursively up the hierarchy
            let currentBase = baseTypeName;
            while (currentBase) {
              if (currentBase === checkType) {
                return { 
                  value: [box(true, { type: 'Boolean', singleton: true })], 
                  context 
                };
              }
              const baseSchema = await (context.modelProvider as any).getSchema(currentBase);
              if (!baseSchema || !baseSchema.base) break;
              currentBase = baseSchema.base.split('/').pop();
            }
          }
        }
        
        // Also check if asking for a resource type like FHIR.Patient
        if (boxedItem.typeInfo.type === checkType || boxedItem.typeInfo.name === checkType) {
          return { 
            value: [box(true, { type: 'Boolean', singleton: true })], 
            context 
          };
        }
      }
      return { 
        value: [box(false, { type: 'Boolean', singleton: true })], 
        context 
      };
    }
    
    // When no namespace is specified (e.g., just "Boolean", "String", "string", "code")
    if (!checkNamespace) {
      // Check for System primitive types (capitalized)
      const systemPrimitiveTypes = ['Boolean', 'String', 'Integer', 'Decimal', 'Date', 'DateTime', 'Time'];
      if (systemPrimitiveTypes.includes(checkType)) {
        // For System primitive types, only match if NOT a FHIR type
        if (boxedItem.typeInfo.namespace === 'FHIR') {
          return { 
            value: [box(false, { type: 'Boolean', singleton: true })], 
            context 
          };
        }
        // Check if the type matches
        if (boxedItem.typeInfo.type === checkType) {
          return { 
            value: [box(true, { type: 'Boolean', singleton: true })], 
            context 
          };
        }
      }
      
      // Check for FHIR primitive types (lowercase) like string, code, id, etc.
      const fhirPrimitiveTypes = ['string', 'code', 'id', 'uri', 'url', 'canonical', 'uuid', 'oid', 
                                   'boolean', 'integer', 'decimal', 'base64Binary', 'instant', 
                                   'date', 'dateTime', 'time', 'unsignedInt', 'positiveInt', 'markdown'];
      if (fhirPrimitiveTypes.includes(checkType)) {
        // For FHIR primitive types, check both the name and underlying type
        if (boxedItem.typeInfo.namespace === 'FHIR') {
          // Check if the name matches
          if (boxedItem.typeInfo.name === checkType) {
            return { 
              value: [box(true, { type: 'Boolean', singleton: true })], 
              context 
            };
          }
          // For 'string', also match code, id, etc. (they are all string-based)
          if (checkType === 'string') {
            const stringBasedTypes = ['code', 'id', 'uri', 'url', 'canonical', 'uuid', 'oid', 'markdown'];
            if (boxedItem.typeInfo.name && stringBasedTypes.includes(boxedItem.typeInfo.name)) {
              return { 
                value: [box(true, { type: 'Boolean', singleton: true })], 
                context 
              };
            }
            // Also check if underlying type is String
            if (boxedItem.typeInfo.type === 'String') {
              return { 
                value: [box(true, { type: 'Boolean', singleton: true })], 
                context 
              };
            }
          }
        }
        return { 
          value: [box(false, { type: 'Boolean', singleton: true })], 
          context 
        };
      }
      
      // For non-primitive types (like Patient, Observation), use model provider
      const matchingType = context.modelProvider.ofType(boxedItem.typeInfo, typeName as TypeName);
      return { 
        value: [box(matchingType !== undefined, { type: 'Boolean', singleton: true })], 
        context 
      };
    }
    
    // Default case - use model provider's ofType for other checks
    const matchingType = context.modelProvider.ofType(boxedItem.typeInfo, typeName as TypeName);
    return { 
      value: [box(matchingType !== undefined, { type: 'Boolean', singleton: true })], 
      context 
    };
  }
  
  // Check if the box has type information (without ModelProvider, check with normalization)
  if (boxedItem?.typeInfo) {
    // Normalize both types for comparison
    let boxedType = boxedItem.typeInfo.type;
    let compareType = typeName;
    
    // Normalize System.X to X for primitive types
    if (compareType.startsWith('System.')) {
      compareType = compareType.substring(7);
    }
    
    // Also check if boxedType needs normalization (unlikely but consistent)
    if (boxedType.startsWith('System.')) {
      boxedType = boxedType.substring(7);
    }
    
    return { 
      value: [box(boxedType === compareType, { type: 'Boolean', singleton: true })], 
      context 
    };
  }
  
  // For FHIR resources without typeInfo, try to get it from modelProvider
  if (context.modelProvider && item && typeof item === 'object' && 'resourceType' in item && typeof item.resourceType === 'string') {
    // Use cached type if available
    const typeInfo = await context.modelProvider.getType(item.resourceType);
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
  
  // Normalize type names - strip namespace for System types
  // System.Boolean -> Boolean, FHIR.boolean -> boolean, etc.
  let normalizedTypeName = typeName;
  if (typeName.startsWith('System.')) {
    normalizedTypeName = typeName.substring(7); // Remove "System."
  } else if (typeName.startsWith('FHIR.')) {
    // For FHIR types, keep the namespace for model provider lookup
    // but also check without namespace for primitive types
    normalizedTypeName = typeName;
  }
  
  // Check primitive types (with normalized names)
  switch (normalizedTypeName) {
    case 'String':
    case 'System.String':
      return { value: [box(typeof item === 'string', { type: 'Boolean', singleton: true })], context };
    case 'Boolean':
    case 'System.Boolean':
      return { value: [box(typeof item === 'boolean', { type: 'Boolean', singleton: true })], context };
    case 'Integer':
    case 'System.Integer':
      return { value: [box(typeof item === 'number' && Number.isInteger(item), { type: 'Boolean', singleton: true })], context };
    case 'Decimal':
    case 'System.Decimal':
      return { value: [box(typeof item === 'number', { type: 'Boolean', singleton: true })], context };
    case 'Date':
      // Check if it's a FHIRDate instance or has Date type
      if (item && typeof item === 'object') {
        return { value: [box(isFHIRDate(item) || (item as any).kind === 'FHIRDate', { type: 'Boolean', singleton: true })], context };
      }
      return { value: [box(false, { type: 'Boolean', singleton: true })], context };
    case 'DateTime':
      // Check if it's a FHIRDateTime instance or has DateTime type
      if (item && typeof item === 'object') {
        return { value: [box(isFHIRDateTime(item) || (item as any).kind === 'FHIRDateTime', { type: 'Boolean', singleton: true })], context };
      }
      return { value: [box(false, { type: 'Boolean', singleton: true })], context };
    case 'Time':
      // Check if it's a FHIRTime instance or has Time type
      if (item && typeof item === 'object') {
        return { value: [box(isFHIRTime(item) || (item as any).kind === 'FHIRTime', { type: 'Boolean', singleton: true })], context };
      }
      return { value: [box(false, { type: 'Boolean', singleton: true })], context };
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