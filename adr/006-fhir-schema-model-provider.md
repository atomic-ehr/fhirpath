# ADR-006: FHIR Schema-based Model Provider

## Status

Accepted

## Context

The current type analyzer uses a hardcoded `MockModelProvider` that manually defines FHIR types and their properties. This approach has several limitations:

1. **Maintenance Burden**: Each type and property must be manually coded
2. **Error Prone**: Easy to miss properties or get cardinality wrong
3. **Not Scalable**: Adding new FHIR resources requires significant code changes
4. **Lacks Fidelity**: Doesn't capture all FHIR type system nuances
5. **Anonymous Types**: Requires artificial type names like "anon:Patient.contact"

FHIR Schema is an analysis-friendly representation of FHIR StructureDefinition that addresses these issues:
- Nested structure matches property navigation patterns
- Explicit array and union type declarations
- Type hierarchy through base types
- Inline anonymous type definitions

Example comparison:

```typescript
// Current hardcoded approach
this.addType('FHIR.Patient', {
  name: { type: 'FHIR.HumanName', isSingleton: false },
  birthDate: { type: 'System.Date', isSingleton: true },
  contact: { type: 'anon:Patient.contact', isSingleton: false }
});

this.addType('anon:Patient.contact', {
  name: { type: 'FHIR.HumanName', isSingleton: true },
  telecom: { type: 'FHIR.ContactPoint', isSingleton: false }
});
```

```yaml
# FHIR Schema approach
Patient:
  base: DomainResource
  elements:
    name: {array: true, type: HumanName}
    birthDate: {type: date}
    contact:
      type: BackboneElement
      array: true
      elements:
        name: {type: HumanName}
        telecom: {array: true, type: ContactPoint}
```

## Decision

Replace the current hardcoded MockModelProvider entirely with a FHIR Schema-based implementation. This is a complete replacement, not a parallel implementation. The new model provider will:

1. **Schema Format Definition**: Use the FHIR Schema structure with:
   - `base`: Parent type for inheritance
   - `elements`: Property definitions
   - `array`: Cardinality indicator (true = collection)
   - `union`: Polymorphic type indicator
   - `type`/`types`: Type references

2. **Type Resolution via Schema Lists**: Instead of resolving inheritance through base types, the model provider will:
   - Return a list of applicable schemas for any type (e.g., `[Resource, DomainResource, Patient]` for Patient type)
   - Property lookup searches through all schemas in order until first match
   - This approach simplifies implementation and matches runtime behavior
   - No need for complex inheritance resolution logic

3. **Property Resolution Strategy**:
   - For type `Patient`, return schemas: `[Patient, DomainResource, Resource]`
   - For property `Patient.name`, search in order: Patient → DomainResource → Resource
   - For nested `Patient.contact.name`, use the inline schema from Patient.contact
   - First matching property definition wins

4. **Type Reference Strategy**:
   - Primitive types: `string`, `integer`, `boolean`, etc.
   - FHIR types: `HumanName`, `Patient`, `Observation`
   - Inline types: Use inline schema definitions (e.g., Patient.contact's elements)
   - Union types: Handled through `union` field

5. **No Backward Compatibility**: The hardcoded approach will be completely removed to:
   - Avoid maintenance of two systems
   - Force adoption of the schema-based approach
   - Simplify the codebase
   - Ensure consistency

## Implementation Details

### Schema Type Definition

```typescript
interface FHIRSchemaElement {
  type?: string;              // Simple type reference
  array?: boolean;            // Is this a collection?
  union?: boolean | string;   // Union type indicator or discriminator
  types?: string[];           // Union type options
  elements?: Record<string, FHIRSchemaElement>; // Nested elements
  valueset?: string;          // Terminology binding
}

interface FHIRSchema {
  base?: string;              // Parent type
  elements?: Record<string, FHIRSchemaElement>;
}

type SchemaRegistry = Record<string, FHIRSchema>;
```

### Model Provider Implementation

```typescript
class SchemaBasedModelProvider implements ModelProvider {
  private schemas: SchemaRegistry;
  private schemaListCache = new Map<string, FHIRSchema[]>();
  
  resolveType(typeName: string): TypeRef | undefined {
    // Check primitive types
    if (isPrimitiveType(typeName)) {
      return `System.${typeName}`;
    }
    
    // Check FHIR types
    if (this.schemas[typeName]) {
      return typeName;
    }
    
    return undefined;
  }
  
  getPropertyType(type: TypeRef, propertyName: string): PropertyInfo | undefined {
    // Get list of schemas for this type (including base types)
    const schemaList = this.getSchemaList(type as string);
    if (!schemaList.length) return undefined;
    
    // Search through schemas in order for the property
    for (const schema of schemaList) {
      const element = schema.elements?.[propertyName];
      if (element) {
        // Handle inline anonymous types
        if (element.elements) {
          // For inline types, create a schema list with just this element
          const inlineSchemaList = [element];
          return {
            type: { schemas: inlineSchemaList }, // TypeRef can be the schema list itself
            isSingleton: !element.array
          };
        }
        
        // Handle union types
        if (element.union === true && element.types) {
          return {
            type: this.createUnionType(element.types),
            isSingleton: !element.array
          };
        }
        
        // Simple property
        return {
          type: element.type!,
          isSingleton: !element.array
        };
      }
    }
    
    return undefined;
  }
  
  private getSchemaList(typeName: string): FHIRSchema[] {
    // Check cache
    if (this.schemaListCache.has(typeName)) {
      return this.schemaListCache.get(typeName)!;
    }
    
    // Build schema list by following base chain
    const schemaList: FHIRSchema[] = [];
    let currentType = typeName;
    
    while (currentType) {
      const schema = this.schemas[currentType];
      if (!schema) break;
      
      schemaList.push(schema);
      currentType = schema.base || '';
    }
    
    // Cache the result
    this.schemaListCache.set(typeName, schemaList);
    return schemaList;
  }
}
```

### Handling Nested Elements

For nested elements like `Patient.contact`, the model provider will:

1. **First lookup**: Find `contact` in Patient schema
2. **Schema list for nested type**: 
   - If `contact` has `type: BackboneElement`, create schema list: `[contact-inline-schema, BackboneElement, Element]`
   - The inline schema from `contact.elements` is treated as the most specific schema
3. **Property resolution in nested context**:
   - For `Patient.contact.name`, search through the schema list for `contact`
   - First check inline `contact.elements.name`
   - Then check `BackboneElement.elements.name` (if any)
   - Then check `Element.elements.name` (if any)

Example:
```typescript
// For Patient.contact.name:
// 1. Get Patient schema list: [Patient, DomainResource, Resource]
// 2. Find 'contact' in Patient
// 3. contact has type: BackboneElement and inline elements
// 4. Create schema list for contact: [contact-inline, BackboneElement, Element]
// 5. Search for 'name' in contact schema list
// 6. Found in contact-inline.elements.name
```

This approach ensures:
- Inheritance works correctly for both top-level and nested types
- Inline schemas take precedence over base type properties
- No special handling needed for anonymous vs named types

### Schema Loading

Schemas can be loaded from:
1. **Inline TypeScript/JavaScript objects**
2. **YAML files** (as shown in fhirschema.md)
3. **JSON files** (converted from YAML)
4. **Generated from FHIR StructureDefinitions**

Example schema file:

```yaml
# primitives.yaml
string:
  primitive: true
integer:
  primitive: true
boolean:
  primitive: true

# base-types.yaml
Element:
  elements:
    id: {type: string}
    extension: {array: true, type: Extension}

BackboneElement:
  base: Element
  elements:
    modifierExtension: {array: true, type: Extension}

# complex-types.yaml  
HumanName:
  base: Element
  elements:
    use: {type: code}
    text: {type: string}
    family: {type: string}
    given: {array: true, type: string}
    prefix: {array: true, type: string}
    suffix: {array: true, type: string}

# resources.yaml
Patient:
  base: DomainResource
  elements:
    identifier: {array: true, type: Identifier}
    active: {type: boolean}
    name: {array: true, type: HumanName}
    telecom: {array: true, type: ContactPoint}
    gender: {type: code}
    birthDate: {type: date}
    deceased: {union: true, types: [boolean, dateTime]}
    address: {array: true, type: Address}
    contact:
      type: BackboneElement
      array: true
      elements:
        relationship: {array: true, type: CodeableConcept}
        name: {type: HumanName}
        telecom: {array: true, type: ContactPoint}
        address: {type: Address}
        gender: {type: code}
        organization: {type: Reference}
```

## Consequences

### Positive

1. **Maintainability**: Schemas are declarative and easy to update
2. **Accuracy**: Direct mapping to FHIR specification
3. **Completeness**: Can represent all FHIR type patterns
4. **Extensibility**: New resources added by adding schemas
5. **Type Safety**: Schema structure can be validated
6. **Reusability**: Schemas can be shared across tools
7. **Anonymous Types**: Handled automatically without artificial names
8. **Union Types**: First-class support for polymorphic properties
9. **Single Source of Truth**: Only one model provider implementation to maintain
10. **Forced Adoption**: No fallback ensures all code uses the new approach

### Negative

1. **Breaking Change**: All existing tests and code must be updated immediately
2. **No Gradual Migration**: Must implement complete schema set upfront
3. **Initial Development**: Higher upfront cost to implement full replacement
4. **Risk**: No fallback if schema approach has issues

### Neutral

1. **External Dependencies**: May need YAML parser for schema files
2. **Schema Source**: Need to decide how to obtain/generate schemas
3. **Versioning**: Need strategy for different FHIR versions

## Alternatives Considered

### 1. Generate TypeScript from StructureDefinitions

Generate TypeScript interfaces directly from FHIR StructureDefinitions.

**Pros:**
- Type-safe at compile time
- Good IDE support
- Direct from source

**Cons:**
- Large generated code
- Harder to customize
- Requires build step

### 2. Runtime StructureDefinition Loading

Load and process raw StructureDefinitions at runtime.

**Pros:**
- Most accurate
- Direct from source

**Cons:**
- Complex processing required
- Performance overhead
- StructureDefinitions are verbose

### 3. Enhanced Hardcoded Approach

Keep hardcoded approach but with better abstractions.

**Pros:**
- Simple
- Fast
- No dependencies

**Cons:**
- Still manual maintenance
- Still error prone
- Doesn't scale

## Decision Rationale

FHIR Schema format is chosen because:

1. **Balanced Abstraction**: More maintainable than hardcoded, simpler than full StructureDefinitions
2. **Analysis Optimized**: Designed specifically for tools like type analyzers
3. **Proven Approach**: Already used in other FHIR tooling
4. **Clean Break**: Complete replacement ensures no technical debt
5. **Human Readable**: YAML format is easy to understand and modify
6. **Simpler Codebase**: Only one implementation to understand and maintain

## Implementation Strategy

Since this is a complete replacement, not a migration, the implementation will be:

1. **Phase 1**: Define Complete Schema Set
   - Create schemas for all types currently in MockModelProvider
   - Ensure 100% coverage of existing functionality
   - Structure schemas in logical files (primitives, datatypes, resources)

2. **Phase 2**: Implement SchemaBasedModelProvider
   - Build complete implementation with all ModelProvider methods
   - Add schema loading and caching
   - Implement inheritance resolution
   - Handle inline types and unions

3. **Phase 3**: Replace MockModelProvider
   - Delete the old MockModelProvider class
   - Rename SchemaBasedModelProvider to ModelProvider
   - Update all imports and instantiations
   - Fix any breaking tests

4. **Phase 4**: Validate and Test
   - Ensure all existing tests pass
   - Add schema-specific tests
   - Verify performance is acceptable

5. **Phase 5**: Documentation
   - Update documentation to reflect schema-based approach
   - Provide schema authoring guidelines
   - Document how to add new FHIR resources