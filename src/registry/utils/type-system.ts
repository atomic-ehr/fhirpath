/**
 * FHIRPath Type System
 * 
 * Handles type checking and casting for FHIRPath expressions.
 * Supports primitive types and FHIR resource types.
 */

export enum PrimitiveType {
  Boolean = 'Boolean',
  String = 'String',
  Integer = 'Integer',
  Decimal = 'Decimal',
  Date = 'Date',
  DateTime = 'DateTime',
  Time = 'Time',
  Quantity = 'Quantity'
}

/**
 * Type information for a value
 */
export interface TypeInfo {
  name: string;
  isPrimitive: boolean;
  isResource?: boolean;
  isList?: boolean;
}

/**
 * Type registry for checking and casting
 */
export class TypeSystem {
  private static primitiveTypes = new Set<string>(Object.values(PrimitiveType));
  
  /**
   * Check if a value is of a specific type
   */
  static isType(value: any, typeName: string): boolean {
    // Handle primitive types
    if (this.primitiveTypes.has(typeName)) {
      return this.isPrimitiveType(value, typeName as PrimitiveType);
    }
    
    // Handle FHIR resource types
    // For now, check if the object has a resourceType property matching the type name
    if (typeof value === 'object' && value !== null) {
      return value.resourceType === typeName;
    }
    
    return false;
  }
  
  /**
   * Check if a value is a primitive type
   */
  private static isPrimitiveType(value: any, type: PrimitiveType): boolean {
    switch (type) {
      case PrimitiveType.Boolean:
        return typeof value === 'boolean';
        
      case PrimitiveType.String:
        return typeof value === 'string';
        
      case PrimitiveType.Integer:
        return typeof value === 'number' && Number.isInteger(value);
        
      case PrimitiveType.Decimal:
        return typeof value === 'number';
        
      case PrimitiveType.Date:
        // Check if it's a date string in FHIR format (YYYY-MM-DD)
        if (typeof value === 'string') {
          return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(value);
        }
        return false;
        
      case PrimitiveType.DateTime:
        // Check if it's a datetime string in FHIR format
        if (typeof value === 'string') {
          return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?$/.test(value);
        }
        return false;
        
      case PrimitiveType.Time:
        // Check if it's a time string in FHIR format (HH:MM:SS)
        if (typeof value === 'string') {
          return /^\d{2}:\d{2}:\d{2}(\.\d{3})?$/.test(value);
        }
        return false;
        
      case PrimitiveType.Quantity:
        // Check if it's a quantity object with value and optional unit
        if (typeof value === 'object' && value !== null) {
          return typeof value.value === 'number' && 
                 (value.unit === undefined || typeof value.unit === 'string');
        }
        return false;
        
      default:
        return false;
    }
  }
  
  /**
   * Cast a value to a specific type (returns empty if cast fails)
   */
  static cast(value: any, typeName: string): any | null {
    // If already the correct type, return as-is
    if (this.isType(value, typeName)) {
      return value;
    }
    
    // Handle FHIR resource casting
    if (!this.primitiveTypes.has(typeName)) {
      // Can't cast between different resource types
      return null;
    }
    
    // Handle primitive type casting
    return this.castToPrimitive(value, typeName as PrimitiveType);
  }
  
  /**
   * Cast to primitive type
   */
  private static castToPrimitive(value: any, type: PrimitiveType): any | null {
    // For now, return null for failed casts
    // Later we can implement actual conversions (e.g., string to number)
    return null;
  }
  
  /**
   * Get type information for a value
   */
  static getType(value: any): TypeInfo {
    // Check primitive types
    if (typeof value === 'boolean') {
      return { name: PrimitiveType.Boolean, isPrimitive: true };
    }
    if (typeof value === 'string') {
      // Check for specific string formats
      if (/^\d{4}(-\d{2}(-\d{2})?)?$/.test(value)) {
        return { name: PrimitiveType.Date, isPrimitive: true };
      }
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        return { name: PrimitiveType.DateTime, isPrimitive: true };
      }
      if (/^\d{2}:\d{2}:\d{2}/.test(value)) {
        return { name: PrimitiveType.Time, isPrimitive: true };
      }
      return { name: PrimitiveType.String, isPrimitive: true };
    }
    if (typeof value === 'number') {
      return { 
        name: Number.isInteger(value) ? PrimitiveType.Integer : PrimitiveType.Decimal, 
        isPrimitive: true 
      };
    }
    
    // Check for FHIR resources
    if (typeof value === 'object' && value !== null) {
      if (value.resourceType) {
        return { name: value.resourceType, isPrimitive: false, isResource: true };
      }
      if (typeof value.value === 'number' && (value.unit || value.code)) {
        return { name: PrimitiveType.Quantity, isPrimitive: true };
      }
    }
    
    // Unknown type
    return { name: 'Unknown', isPrimitive: false };
  }
}