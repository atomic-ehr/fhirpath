import type { ModelProvider as IModelProvider, PropertyInfo, TypeRef } from './types';
import type { FHIRSchema, SchemaRegistry, SchemaTypeRef } from './schemas/types';

/**
 * Model provider implementation using FHIR schemas
 * Resolves types and properties through a schema registry
 */
export class ModelProvider implements IModelProvider {
  private registry: SchemaRegistry;
  private schemaListCache = new Map<string, FHIRSchema[]>();
  
  constructor(registry: SchemaRegistry) {
    this.registry = registry;
  }
  
  resolveType(typeName: string): TypeRef | undefined {
    // Normalize type names - handle both "String" and "string" formats
    const normalizedName = this.normalizeTypeName(typeName);
    
    const schemas = this.getSchemaList(normalizedName);
    if (!schemas.length) return undefined;
    
    // Return opaque TypeRef (which is actually SchemaTypeRef)
    const schemaTypeRef: SchemaTypeRef = {
      schemas,
      type: this.isPrimitiveType(normalizedName) ? normalizedName : 'complex-type'
      // array is not set here - it's property-specific
    };
    return schemaTypeRef as unknown as TypeRef;
  }
  
  getPropertyType(type: TypeRef, propertyName: string): PropertyInfo | undefined {
    const schemaRef = type as unknown as SchemaTypeRef;
    
    // Search through type.schemas for the property
    for (const schema of schemaRef.schemas) {
      const element = schema.elements?.[propertyName];
      if (element) {
        // Handle union types
        if (element.union === true && element.types) {
          // For now, return Any type for unions
          // In future, this could return a proper union type
          return {
            type: this.resolveType('Any')!,
            isSingleton: !element.array
          };
        }
        
        // Build TypeRef for the property's type
        let propSchemas: FHIRSchema[];
        
        if (element.elements) {
          // Inline type with nested elements
          const inlineSchema: FHIRSchema = {
            name: `${this.getSchemaName(schema)}.${propertyName}`,
            base: element.type || 'BackboneElement',
            elements: element.elements
          };
          
          // Get base type schemas if any
          const baseSchemas = element.type ? this.getSchemaList(element.type) : [];
          propSchemas = [inlineSchema, ...baseSchemas];
        } else if (element.type) {
          // Simple type reference
          propSchemas = this.getSchemaList(element.type);
        } else {
          // No type specified - shouldn't happen in valid schemas
          continue;
        }
        
        const propTypeRef: SchemaTypeRef = {
          schemas: propSchemas,
          type: element.type && this.isPrimitiveType(element.type) ? element.type : 'complex-type',
          array: element.array
        };
        
        return {
          type: propTypeRef as unknown as TypeRef,
          isSingleton: !element.array
        };
      }
    }
    
    return undefined;
  }
  
  isAssignable(from: TypeRef, to: TypeRef): boolean {
    const fromRef = from as unknown as SchemaTypeRef;
    const toRef = to as unknown as SchemaTypeRef;
    
    // Same type is always assignable
    if (fromRef.type === toRef.type && fromRef.type !== 'complex-type') {
      return true;
    }
    
    // Any is assignable to/from everything
    if (fromRef.type === 'Any' || toRef.type === 'Any') {
      return true;
    }
    
    // For complex types, check if 'from' is a subtype of 'to'
    if (fromRef.type === 'complex-type' && toRef.type === 'complex-type') {
      const fromSchema = fromRef.schemas?.[0];
      const toSchema = toRef.schemas?.[0];
      
      if (!fromSchema || !toSchema) return false;
      
      const fromName = this.getSchemaName(fromSchema);
      const toName = this.getSchemaName(toSchema);
      
      // Check if 'to' appears in 'from's schema list (inheritance chain)
      return fromRef.schemas.some(schema => this.getSchemaName(schema) === toName);
    }
    
    // Handle primitive type inheritance (e.g., code extends string)
    if (this.isPrimitiveType(fromRef.type) && this.isPrimitiveType(toRef.type)) {
      const fromSchemas = this.getSchemaList(fromRef.type);
      return fromSchemas.some(schema => schema.name === toRef.type);
    }
    
    return false;
  }
  
  getTypeName(type: TypeRef): string {
    // Handle undefined type
    if (!type || typeof type !== 'object') {
      return 'Unknown';
    }
    
    // Cast to our internal SchemaTypeRef structure
    const typeRef = type as unknown as SchemaTypeRef;
    
    if (typeRef.type !== 'complex-type') {
      // Capitalize primitive type names for display
      return typeRef.type.charAt(0).toUpperCase() + typeRef.type.slice(1);
    }
    
    // For complex types, use the name of the first schema
    const schema = typeRef.schemas?.[0];
    if (!schema) return 'Unknown';
    return this.getSchemaName(schema);
  }
  
  isCollectionType(type: TypeRef): boolean {
    // The collection nature is carried in the TypeRef itself
    const typeRef = type as unknown as SchemaTypeRef;
    return typeRef.array || false;
  }
  
  getCommonType(types: TypeRef[]): TypeRef | undefined {
    if (types.length === 0) {
      return undefined;
    }
    
    if (types.length === 1) {
      return types[0];
    }
    
    // For simplicity, if all types are the same, return that type
    const typeNames = types.map(t => this.getTypeName(t));
    if (typeNames.every(name => name === typeNames[0])) {
      return types[0];
    }
    
    // Otherwise return Any
    return this.resolveType('Any');
  }
  
  private getSchemaList(typeName: string): FHIRSchema[] {
    // Check cache first
    if (this.schemaListCache.has(typeName)) {
      return this.schemaListCache.get(typeName)!;
    }
    
    // Build schema list by following base chain
    const schemaList: FHIRSchema[] = [];
    let currentType = typeName;
    
    while (currentType) {
      const schema = this.registry.resolve(currentType);
      if (!schema) break;
      
      // Add name to schema if not present (for primitives)
      if (!schema.name) {
        schema.name = currentType;
      }
      
      schemaList.push(schema);
      currentType = schema.base || '';
    }
    
    // Cache the result
    this.schemaListCache.set(typeName, schemaList);
    return schemaList;
  }
  
  private getSchemaName(schema: FHIRSchema): string {
    // Schema should have a name, either explicit or set during resolution
    return schema.name || 'Unknown';
  }
  
  private isPrimitiveType(typeName: string): boolean {
    // List of known primitive types
    const primitives = [
      'string', 'integer', 'decimal', 'boolean',
      'date', 'dateTime', 'time', 'instant',
      'code', 'id', 'uri', 'url', 'canonical',
      'base64Binary', 'markdown', 'unsignedInt', 'positiveInt',
      'Any'
    ];
    
    return primitives.includes(typeName);
  }
  
  private normalizeTypeName(typeName: string): string {
    // Handle different naming conventions
    // "String" -> "string", "Integer" -> "integer", etc.
    
    // First check if it's a primitive type with capital letter
    const lowerName = typeName.toLowerCase();
    if (this.isPrimitiveType(lowerName)) {
      return lowerName;
    }
    
    // Handle System namespace
    if (typeName.startsWith('System.')) {
      const baseName = typeName.substring(7);
      const lowerBase = baseName.toLowerCase();
      if (this.isPrimitiveType(lowerBase)) {
        return lowerBase;
      }
      // System.Quantity -> Quantity
      return baseName;
    }
    
    // Handle FHIR namespace
    if (typeName.startsWith('FHIR.')) {
      return typeName.substring(5);
    }
    
    // Default - return as is
    return typeName;
  }
}