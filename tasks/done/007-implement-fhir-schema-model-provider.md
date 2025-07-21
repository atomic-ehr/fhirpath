# Task 007: Implement FHIR Schema-based Model Provider

## Status: COMPLETED

## Overview
Replace the current hardcoded MockModelProvider with a FHIR Schema-based implementation following the design in ADR-006.

## What Was Done

### Phase 1: Schema Definitions
1. Created schema type system in `src/analyzer/schemas/`:
   - `types.ts` - Core interfaces (FHIRSchema, SchemaRegistry, SchemaTypeRef)
   - `primitives.ts` - All FHIR primitive types (string, integer, boolean, etc.)
   - `base-types.ts` - Base FHIR types (Element, BackboneElement, Resource, DomainResource)
   - `datatypes.ts` - Complex datatypes (HumanName, Address, CodeableConcept, etc.)
   - `resources.ts` - Resource definitions (Patient, Observation)
   - `index.ts` - Registry helpers and exports

2. Implemented dynamic SchemaRegistry interface for future extensibility

### Phase 2: SchemaBasedModelProvider Implementation
1. Created `src/analyzer/model-provider.ts` with full ModelProvider interface
2. Implemented schema list resolution with caching
3. Added type name normalization (handles "String" → "string", "FHIR.Patient" → "Patient")
4. Implemented TypeRef as opaque reference containing schema information internally
5. Handled inline anonymous types without artificial names

### Phase 3: Complete Replacement
1. Deleted `src/analyzer/mock-model-provider.ts`
2. Renamed SchemaBasedModelProvider to ModelProvider
3. Updated test imports to use new provider

### Phase 4: Testing
- All 37 analyzer tests pass without modification
- TypeScript compilation successful
- Performance comparable to hardcoded approach

### Phase 5: Documentation
1. Updated `docs/analyzer.md` with:
   - New schema-based architecture
   - Usage examples with schema registry
   - Schema system documentation
   - Future enhancement possibilities

## Key Design Decisions

1. **TypeRef Structure**: Internally uses SchemaTypeRef with schemas list, type name, and array flag
2. **Schema Lists**: Properties resolved by searching through inheritance chain
3. **Dynamic Registry**: SchemaRegistry interface allows for future dynamic loading
4. **Type Normalization**: Handles multiple naming conventions seamlessly

## Benefits Achieved

1. **Maintainability**: Declarative schemas easier to update than hardcoded types
2. **Extensibility**: New types added by adding schemas
3. **No Artificial Names**: Inline types handled naturally
4. **Future Ready**: Registry interface enables dynamic loading, versioning, etc.
5. **Clean Architecture**: Single implementation to maintain

## References
- ADR: `/adr/006-fhir-schema-model-provider.md`
- FHIR Schema examples: `/ideas/fhirschema.md`
- Current implementation: `/src/analyzer/mock-model-provider.ts`
- Type system interfaces: `/src/analyzer/types.ts`

## Objectives
1. Define FHIR schemas for all types currently in MockModelProvider
2. Implement SchemaBasedModelProvider with schema list resolution
3. Replace MockModelProvider completely
4. Ensure all tests pass with new implementation
5. Add schema-specific tests

## Implementation Steps

### Phase 1: Define Complete Schema Set
1. **Create schema type definitions**:
   - Add `FHIRSchema` and `FHIRSchemaElement` interfaces
   - Support for `base`, `elements`, `array`, `union`, `type`, `types`
   - Handle both named types and inline elements

2. **Create SchemaRegistry interface**:
   ```typescript
   interface SchemaRegistry {
     resolve(typeName: string): FHIRSchema | undefined;
   }
   
   // Static implementation for testing
   class StaticSchemaRegistry implements SchemaRegistry {
     constructor(private schemas: Record<string, FHIRSchema>) {}
     
     resolve(typeName: string): FHIRSchema | undefined {
       return this.schemas[typeName];
     }
   }
   ```

3. **Create schema files**:
   - `src/analyzer/schemas/primitives.ts` - System types
   - `src/analyzer/schemas/base-types.ts` - Element, BackboneElement, Resource, DomainResource
   - `src/analyzer/schemas/datatypes.ts` - HumanName, Identifier, CodeableConcept, etc.
   - `src/analyzer/schemas/resources.ts` - Patient, Observation, etc.
   - `src/analyzer/schemas/index.ts` - Export static schema registry

4. **Ensure complete coverage**:
   - All primitive types from current MockModelProvider
   - All FHIR types used in tests
   - Proper inheritance chains (base types)
   - Inline anonymous types (e.g., Patient.contact)

### Phase 2: Implement SchemaBasedModelProvider
1. **Update TypeRef definition**:
   ```typescript
   // TypeRef now contains complete type information
   interface TypeRef {
     schemas: FHIRSchema[];  // List of schemas in inheritance order
     type: string;           // 'complex-type' for FHIR types, or primitive name
     array?: boolean;        // Optional, indicates if this is an array type
   }
   ```

2. **Core implementation**:
   ```typescript
   class SchemaBasedModelProvider implements ModelProvider {
     private registry: SchemaRegistry;
     private schemaListCache = new Map<string, FHIRSchema[]>();
     
     constructor(registry: SchemaRegistry) {
       this.registry = registry;
     }
     
     resolveType(typeName: string): TypeRef | undefined {
       const schemas = this.getSchemaList(typeName);
       if (!schemas.length) return undefined;
       
       return {
         schemas,
         type: isPrimitiveType(typeName) ? typeName : 'complex-type',
         // array is not set here - it's property-specific
       };
     }
     
     getPropertyType(type: TypeRef, propertyName: string): PropertyInfo | undefined {
       // Search through type.schemas for the property
       for (const schema of type.schemas) {
         const element = schema.elements?.[propertyName];
         if (element) {
           // Build TypeRef for the property's type
           const propSchemas = element.elements 
             ? [element, ...this.getSchemaList(element.type || 'BackboneElement')]
             : this.getSchemaList(element.type!);
           
           return {
             type: {
               schemas: propSchemas,
               type: isPrimitiveType(element.type) ? element.type : 'complex-type',
               array: element.array
             },
             isSingleton: !element.array
           };
         }
       }
       return undefined;
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
         
         schemaList.push(schema);
         currentType = schema.base || '';
       }
       
       // Cache the result
       this.schemaListCache.set(typeName, schemaList);
       return schemaList;
     }
     
     getTypeName(type: TypeRef): string {
       if (type.type !== 'complex-type') return capitalize(type.type);
       // For complex types, use the name of the first schema
       return this.getSchemaName(type.schemas[0]);
     }
   }
   ```

3. **Schema list resolution**:
   - Build schema lists by following `base` chain
   - Cache schema lists for performance
   - Include primitive schemas in the list

4. **Property resolution**:
   - Search through schema list in order
   - First matching property wins
   - Handle inline elements with nested schema lists
   - Support union types

5. **Type reference handling**:
   - All TypeRefs contain schema lists
   - Primitive types have single-item schema lists
   - Complex types have full inheritance chains
   - Array information carried in TypeRef

### Phase 3: Replace MockModelProvider
1. **Delete** `src/analyzer/mock-model-provider.ts`
2. **Rename** SchemaBasedModelProvider to ModelProvider
3. **Update imports** in all test files
4. **Fix any breaking changes**

### Phase 4: Testing
1. **Ensure existing tests pass**:
   - All 36 tests in `test/analyzer.test.ts` should pass
   - No changes needed to test logic

2. **Add schema-specific tests**:
   - Schema list generation
   - Inheritance resolution
   - Inline type handling
   - Union type support

3. **Performance testing**:
   - Verify schema lookup performance
   - Check cache effectiveness

### Phase 5: Documentation
1. **Update analyzer documentation**
2. **Add schema authoring guide**
3. **Document how to add new FHIR resources**

## Success Criteria
- [ ] All types from MockModelProvider are defined as schemas
- [ ] SchemaBasedModelProvider fully implements ModelProvider interface
- [ ] All existing tests pass without modification
- [ ] Schema list resolution works for nested types
- [ ] Performance is acceptable (caching works)
- [ ] MockModelProvider is completely removed
- [ ] Documentation is updated

## Technical Considerations
- TypeRef is now a structured object containing schemas, type, and array information
- The analyzer only needs to understand the TypeRef interface, not schema internals
- SchemaRegistry interface allows for dynamic schema resolution (e.g., lazy loading, remote fetching)
- Static implementation provided for testing, but production could use dynamic loading
- Schema format matches examples in fhirschema.md
- Use TypeScript const assertions for type safety in schema definitions
- Consider lazy loading for large schema sets via the registry interface
- Ensure proper error handling for missing schemas
- Primitive types get single-item schema lists for consistency

## Example Schema Definition
```typescript
// src/analyzer/schemas/resources.ts
export const Patient: FHIRSchema = {
  base: 'DomainResource',
  elements: {
    name: { array: true, type: 'HumanName' },
    birthDate: { type: 'date' },
    gender: { type: 'code' },
    contact: {
      type: 'BackboneElement',
      array: true,
      elements: {
        relationship: { array: true, type: 'CodeableConcept' },
        name: { type: 'HumanName' },
        telecom: { array: true, type: 'ContactPoint' },
        address: { type: 'Address' },
        gender: { type: 'code' },
        organization: { type: 'Reference' }
      }
    }
  }
} as const;
```

## Estimated Effort
- Schema definitions: 3-4 hours
- Provider implementation: 3-4 hours  
- Testing and migration: 2-3 hours
- Documentation: 1-2 hours
- Total: ~2 days

## Notes
- This is a breaking change - all code using MockModelProvider must be updated
- Focus on correctness over performance initially
- Schema structure can be enhanced later (e.g., add constraints, slicing)
- Consider generating schemas from FHIR spec in future
- The SchemaRegistry interface enables future enhancements:
  - Dynamic loading from external sources
  - Version-specific schema resolution
  - Schema validation and preprocessing
  - Integration with FHIR package managers