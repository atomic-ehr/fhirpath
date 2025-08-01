# ADR-004: Model Provider Interface

## Status

Accepted

## Context

FHIRPath is designed to navigate hierarchical data models like FHIR resources, CDA documents, or other structured data. Currently, our implementation has no knowledge of the underlying data model's structure, which limits its capabilities:

1. **No property validation**: Cannot validate if `Patient.foo` is a valid property access
2. **No type information**: Cannot determine that `Patient.name` returns `HumanName[]`
3. **Limited error messages**: Cannot provide model-specific guidance like "Did you mean 'given' instead of 'givne'?"
4. **No autocomplete support**: Cannot suggest valid properties for a given type
5. **No polymorphic understanding**: Cannot handle type hierarchies or inheritance

While FHIRPath can work without model knowledge (treating everything as dynamic navigation), having model awareness would significantly improve:
- Static analysis and validation
- IDE features (autocomplete, hover information)
- Error messages and debugging
- Type safety and optimization opportunities

## Decision

Create a Model Provider interface that allows FHIRPath implementations to integrate with different data models while keeping the core engine model-agnostic.

### Core Interface Design

Based on our implementation experience, we've simplified the interface to focus on essential operations:

```typescript
// Model Provider Interface
export interface ModelProvider<TypeContext = unknown> {
  /**
   * Get type information for a named type in the model
   * @param typeName - The type name (e.g., "Patient", "string")
   * @returns Type information with FHIRPath type and model context
   */
  getType(typeName: string): TypeInfo<TypeContext> | undefined;
  
  /**
   * Navigate from a type to one of its properties/elements
   * @param parentType - The parent type (with model context)
   * @param propertyName - The property name (single level)
   * @returns Type information of the property or undefined
   */
  getElementType(parentType: TypeInfo<TypeContext>, propertyName: string): TypeInfo<TypeContext> | undefined;
  
  /**
   * Filter a type to a specific FHIRPath type (for union types)
   * @param type - The type to filter (may be a union)
   * @param typeName - The FHIRPath type to filter to
   * @returns Filtered type information or undefined
   */
  ofType(type: TypeInfo<TypeContext>, typeName: TypeName): TypeInfo<TypeContext> | undefined;
  
  /**
   * Get available property names for a type
   * @param parentType - The type to get properties for
   * @returns Array of property names
   */
  getElementNames(parentType: TypeInfo<TypeContext>): string[];
}

// TypeInfo structure (from ADR-005)
export interface TypeInfo<TypeContext = unknown> {
  // FHIRPath computational type
  type: TypeName;
  
  // Whether this is a single value (vs collection)
  singleton?: boolean;
  
  // Model type information
  namespace?: string;
  name?: string;
  
  // Opaque context for model provider implementation
  modelContext?: TypeContext;
}
```

### Key Design Principles

1. **Separation of Concerns**: The TypeInfo structure cleanly separates FHIRPath types from model-specific information
2. **Opaque Context**: The `modelContext` field allows implementations to store any necessary internal state without exposing it
3. **Union Type Handling**: Union/choice types are handled through the `ofType` method rather than explicit properties
4. **Simplified API**: Focus on essential operations that enable type-aware navigation

### Handling Union Types

Union types (like FHIR choice types) are represented as:
- TypeInfo with `type: 'Any'`
- Internal union state stored in `modelContext`
- The `ofType` method filters to specific types within the union

```typescript
// Example: Patient.multipleBirth[x] can be boolean or integer
const multipleBirthType = provider.getElementType(patientType, 'multipleBirth');
// Returns: { type: 'Any', ... }

const booleanType = provider.ofType(multipleBirthType, 'Boolean');
// Returns: { type: 'Boolean', ... } or undefined if not applicable
```

### Integration Points

The Model Provider will integrate with:

1. **Parser**: For validating type references in `as` and `is` operators
2. **Analyzer**: For type inference and validation
3. **Interpreter**: For runtime type checking and optimization
4. **Language Server**: For IDE features like autocomplete and hover

### Implementation Example

```typescript
// Simple mock implementation showing key concepts
interface ModelContext {
  path: string;
  schemaset: TypeSchema[];
  // Union type information stored internally
  isUnion?: boolean;
  choices?: Array<{
    type: TypeName;
    name: string;
    singleton: boolean;
  }>;
}

const typeConversion: Record<string, TypeName> = {
  'string': 'String',
  'boolean': 'Boolean',
  'integer': 'Integer',
  'decimal': 'Decimal',
  'date': 'Date',
  'dateTime': 'DateTime',
  // ... more mappings
};

export const modelProvider: ModelProvider<ModelContext> = {
  getType: (typeName: string): TypeInfo<ModelContext> | undefined => {
    const schema = model[typeName];
    if (!schema) {
      // Check primitive types
      if (typeConversion[typeName]) {
        return {
          type: typeConversion[typeName],
          namespace: 'FHIR',
          name: typeName,
          singleton: true,
          modelContext: { path: typeName, schemaset: [] }
        };
      }
      return undefined;
    }
    
    // Return complex type as 'Any' with model context
    return {
      type: 'Any',
      namespace: 'FHIR',
      name: typeName,
      singleton: true,
      modelContext: { 
        path: typeName, 
        schemaset: getParents(schema) 
      }
    };
  },
  
  getElementType: (parentType: TypeInfo<ModelContext>, propertyName: string): TypeInfo<ModelContext> | undefined => {
    const schemaset = parentType.modelContext?.schemaset;
    
    // Find element in schema hierarchy
    let elementSchema = findElementInHierarchy(schemaset, propertyName);
    if (!elementSchema) return undefined;
    
    // Handle choice types
    if (elementSchema.choices) {
      const choices = elementSchema.choices.map(choice => ({
        type: typeConversion[choice.type] || 'Any',
        name: choice.type,
        singleton: !elementSchema.array
      }));
      
      return {
        type: 'Any',  // Union types are 'Any'
        namespace: 'FHIR',
        name: parentType.modelContext?.path + '.' + propertyName,
        singleton: !elementSchema.array,
        modelContext: { 
          path: parentType.modelContext?.path + '.' + propertyName,
          schemaset: [elementSchema],
          isUnion: true,
          choices
        }
      };
    }
    
    // Handle regular types
    const fhirpathType = typeConversion[elementSchema.type] || 'Any';
    return {
      type: fhirpathType,
      namespace: 'FHIR',
      name: elementSchema.type,
      singleton: !elementSchema.array,
      modelContext: {
        path: parentType.modelContext?.path + '.' + propertyName,
        schemaset: getTypeSchemaset(elementSchema.type)
      }
    };
  },
  
  ofType: (type: TypeInfo<ModelContext>, typeName: TypeName): TypeInfo<ModelContext> | undefined => {
    const context = type.modelContext;
    
    // Handle union types
    if (context?.isUnion && context?.choices) {
      for (const choice of context.choices) {
        if (choice.type === typeName) {
          return {
            type: choice.type,
            namespace: 'FHIR',
            name: choice.name,
            singleton: choice.singleton,
            modelContext: {
              path: context.path + `[${choice.name}]`,
              schemaset: []
            }
          };
        }
      }
      return undefined;
    }
    
    // For non-union types, check direct match
    return type.type === typeName ? type : undefined;
  },
  
  getElementNames: (parentType: TypeInfo<ModelContext>): string[] => {
    const schemaset = parentType.modelContext?.schemaset || [];
    const names: Set<string> = new Set();
    
    // Collect properties from all schemas in hierarchy
    for (const schema of schemaset) {
      if (schema.elements) {
        Object.keys(schema.elements).forEach(name => names.add(name));
      }
    }
    
    return Array.from(names);
  }
};
```

### Usage Pattern

```typescript
// Navigate through types
const patientType = provider.getType('Patient');
const nameType = provider.getElementType(patientType, 'name');
const givenType = provider.getElementType(nameType, 'given');

// Handle union types
const multipleBirthType = provider.getElementType(patientType, 'multipleBirth');
// Returns: { type: 'Any', ... } with union info in modelContext

const booleanType = provider.ofType(multipleBirthType, 'Boolean');
// Returns: { type: 'Boolean', ... } if boolean is valid choice
```

### Integration with the Engine

The analyzer uses the model provider to validate navigation:

```typescript
function analyzeNavigation(
  currentType: TypeInfo, 
  propertyName: string,
  provider: ModelProvider
): TypeInfo {
  const nextType = provider.getElementType(currentType, propertyName);
  if (!nextType) {
    const typeName = currentType.namespace && currentType.name 
      ? `${currentType.namespace}.${currentType.name}` 
      : 'unknown';
    throw new Error(
      `Property '${propertyName}' does not exist on type '${typeName}'`
    );
  }
  return nextType;
}
```

## Consequences

### Positive

- **Model awareness**: FHIRPath engine can validate property navigation
- **Type safety**: Proper handling of union/choice types through `ofType`
- **Clean API**: Simple interface with only essential methods
- **Extensibility**: Works with any data model through the generic TypeContext
- **Implementation freedom**: Model details stay encapsulated in modelContext
- **Testable**: Focus on behavior rather than implementation details

### Negative

- **Additional interface**: Requires implementation for model awareness
- **Memory overhead**: Model context may contain substantial metadata
- **Complexity**: Union type handling requires careful implementation

## Alternatives Considered

### 1. Built-in FHIR Support
Hard-code FHIR types directly into the FHIRPath engine.
- **Pros**: Simpler, no abstraction needed
- **Cons**: Not extensible, couples engine to FHIR

### 2. Schema Files
Use schema files (JSON Schema, XML Schema) to describe types.
- **Pros**: Standard formats, declarative
- **Cons**: May not capture all semantics, parsing overhead

### 3. Code Generation
Generate type-specific code from model definitions.
- **Pros**: Type-safe, performant
- **Cons**: Build complexity, large code size

### 4. Runtime Reflection
Inspect actual data instances to infer types.
- **Pros**: No model needed, works with any data
- **Cons**: Incomplete information, no static analysis

## Implementation Strategy

### Phase 1: Core Interface
- Define the ModelProvider interface
- Create a simple test implementation
- Integrate with analyzer for basic validation

### Phase 2: FHIR Provider
- Implement complete FHIR R4 model provider
- Load from FHIR structure definitions
- Handle complex FHIR concepts (choice types, extensions)

### Phase 3: Advanced Features
- Polymorphic property resolution
- Type hierarchy support
- Constraint validation
- Performance optimization

### Phase 4: IDE Integration
- Autocomplete provider using model information
- Hover information from documentation
- Go-to-definition for types

## Security Considerations

- Model providers should validate input to prevent injection
- Large models could cause memory issues - implement limits
- Cache type information appropriately
- Consider lazy loading for large type systems

## Performance Considerations

- Type lookups should be O(1) where possible
- Cache frequently accessed paths
- Lazy load type information
- Consider indexing strategies for large models

## Future Extensions

1. **Versioning**: Support multiple versions of a model
2. **Profiles**: Support constrained types (FHIR profiles)
3. **Extensions**: Model custom extensions
4. **Validation**: Full constraint validation beyond types
5. **Generation**: Generate TypeScript types from model

## Summary: Benefits of the Simplified Design

The implemented design provides several key advantages:

1. **Clean Separation**: TypeInfo focuses on FHIRPath types, modelContext handles model-specific details
2. **Union Type Handling**: Choice types are elegantly handled through the `ofType` method
3. **Simple API**: Only four essential methods needed for full functionality
4. **Type Safety**: The opaque `modelContext` allows implementations to maintain type information without exposing internals
5. **Flexibility**: Implementations can use any internal representation (schemas, type definitions, etc.)
6. **Testability**: Public API can be tested without knowledge of implementation details

The design strikes a balance between simplicity and functionality, providing just enough interface to enable model-aware FHIRPath evaluation without over-engineering.

## References

- FHIR Structure Definitions
- FHIRPath Specification Section 3.1 (Path Selection)
- Language Server Protocol - Completion and Hover
- TypeScript Language Service API
- ADR-003: Type-Enriched AST (for analyzer integration)