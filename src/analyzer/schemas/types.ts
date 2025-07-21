// FHIR Schema type definitions
// Note: Actual schema definitions are not included in the analyzer
// In production, schemas should be loaded from the fhirschema library
// Test schemas are located in test/test-schemas.ts

export interface FHIRSchemaElement {
  type?: string;              // Simple type reference
  array?: boolean;            // Is this a collection?
  union?: boolean | string;   // Union type indicator or discriminator
  types?: string[];           // Union type options
  elements?: Record<string, FHIRSchemaElement>; // Nested elements
  valueset?: string;          // Terminology binding
}

export interface FHIRSchema {
  name?: string;              // Schema name (for primitives and inline types)
  base?: string;              // Parent type
  primitive?: boolean;        // Is this a primitive type?
  elements?: Record<string, FHIRSchemaElement>;
}

export interface SchemaRegistry {
  resolve(typeName: string): FHIRSchema | undefined;
}

// Static implementation for testing
export class StaticSchemaRegistry implements SchemaRegistry {
  constructor(private schemas: Record<string, FHIRSchema>) {}
  
  resolve(typeName: string): FHIRSchema | undefined {
    return this.schemas[typeName];
  }
}

// Schema-based type reference used internally by ModelProvider
export interface SchemaTypeRef {
  schemas: FHIRSchema[];  // List of schemas in inheritance order
  type: string;           // 'complex-type' for FHIR types, or primitive name
  array?: boolean;        // Optional, indicates if this is an array type
}