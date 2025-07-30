# ADR-004: Model Provider Interface

## Status

Proposed

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

```typescript
// Import TypeInfo from ADR-005
import type { TypeInfo, TypeName } from './types';

/**
 * Generic interface for providing model type information
 * Works with any type system through the TypeContext generic parameter
 */
export interface ModelTypeProvider<TypeContext = unknown> {
  /**
   * Get type information for a named type in the model
   * @param typeName - The type name (e.g., "Patient", "Observation")
   * @returns Type information or undefined if not found
   */
  getTypeByName(typeName: string): TypeInfo | undefined;
  
  /**
   * Navigate from a type to one of its properties
   * @param parentType - The parent type (with model context)
   * @param propertyName - The property name (single level, not path)
   * @returns Type information of the property or undefined if not found
   */
  navigateProperty(parentType: TypeInfo, propertyName: string): TypeInfo | undefined;
  
  /**
   * Check if a property exists on a type
   * @param parentType - The parent type to check
   * @param propertyName - The property name (single level, not path)
   */
  hasProperty(parentType: TypeInfo, propertyName: string): boolean;
  
  /**
   * Get available property names for a type
   * Used for autocomplete and validation
   * @param parentType - The type to get properties for
   * @returns Array of property names
   */
  getPropertyNames(parentType: TypeInfo): string[];
  
  /**
   * Check if a type name exists in the model
   * @param typeName - The type name to check
   */
  hasTypeName(typeName: string): boolean;
  
  /**
   * Get all available type names in the model
   * Used for autocomplete and validation of type references
   */
  getAllTypeNames(): string[];
  
  /**
   * Check type compatibility for casting/assignment
   * @param source - The source type
   * @param target - The target type to check against
   * @returns true if source is compatible with target
   */
  isTypeCompatible(source: TypeInfo, target: TypeInfo): boolean;
  
  /**
   * Convert a model type name to FHIRPath type
   * @param typeName - The model type name
   * @returns The corresponding FHIRPath type
   */
  mapToFHIRPathType(typeName: string): TypeName;
  
  /**
   * Get documentation for a type (optional)
   * @param type - The type to get documentation for
   * @returns Documentation string or undefined
   */
  getTypeDocumentation?(type: TypeInfo): string | undefined;
  
  /**
   * Get documentation for a property (optional)
   * @param parentType - The parent type
   * @param propertyName - The property name
   * @returns Documentation string or undefined
   */
  getPropertyDocumentation?(parentType: TypeInfo, propertyName: string): string | undefined;
}
```

### Integration with TypeInfo System

The Model Provider leverages the TypeInfo structure from ADR-005:

1. **Uses `TypeInfo`**: The unified type structure that supports both FHIRPath and model types
2. **Dual type system**: Maintains FHIRPath computational types while preserving model information
3. **Union type support**: Can represent choice types through the `union` flag and `choices` array
4. **Complex type elements**: The `elements` map enables property navigation without full model loading
5. **Preserves type safety**: The opaque `modelContext` allows type-safe navigation without exposing internals

```typescript
// TypeInfo from ADR-005
interface TypeInfo {
  // FHIRPath type
  type: TypeName;
  union?: boolean;
  singleton?: boolean;

  // Model type information
  namespace?: string;
  name?: string;

  // For union types
  choices?: TypeInfo[];

  // For complex types
  elements?: {
    [key: string]: TypeInfo;
  }

  // Model context
  modelContext?: unknown;
}
```

### Integration Points

The Model Provider will integrate with:

1. **Parser**: For validating type references in `as` and `is` operators
2. **Analyzer**: For type inference and validation
3. **Interpreter**: For runtime type checking and optimization
4. **Language Server**: For IDE features like autocomplete and hover

### Usage Example

```typescript
// Example: Implement a model provider for FHIR
interface FHIRContext {
  structureDefinition?: StructureDefinition;
  elementDefinition?: ElementDefinition;
  path?: string;
}

class FHIRModelProvider implements ModelTypeProvider<FHIRContext> {
  private structures: Map<string, StructureDefinition>;
  
  constructor(definitions: StructureDefinition[]) {
    this.structures = new Map();
    definitions.forEach(sd => {
      this.structures.set(sd.type, sd);
    });
  }
  
  getTypeByName(typeName: string): TypeInfo | undefined {
    const sd = this.structures.get(typeName);
    if (!sd) return undefined;
    
    // Build elements map for the type
    const elements = this.buildElementsMap(sd);
    
    // Return TypeInfo with model context
    return {
      type: 'Any',  // Complex types are 'Any' in FHIRPath
      singleton: true,
      namespace: 'FHIR',
      name: typeName,
      elements,
      modelContext: {
        structureDefinition: sd,
        path: sd.type
      } as FHIRContext
    };
  }
  
  navigateProperty(parentType: TypeInfo, propertyName: string): TypeInfo | undefined {
    // Check if property exists in elements map
    if (parentType.elements && parentType.elements[propertyName]) {
      return parentType.elements[propertyName];
    }
    
    // Fallback to model context
    const context = parentType.modelContext as FHIRContext;
    if (!context?.structureDefinition) return undefined;
    
    const sd = context.structureDefinition;
    const propertyPath = `${sd.type}.${propertyName}`;
    
    // Find the element definition for this property
    const element = sd.differential.element.find(e => e.path === propertyPath);
    if (!element) return undefined;
    
    // Handle choice types (e.g., value[x])
    if (element.type && element.type.length > 1) {
      return this.createUnionType(element, propertyPath, sd);
    }
    
    // Single type property
    const fhirpathType = this.mapElementToFHIRPathType(element);
    
    return {
      type: fhirpathType,
      singleton: element.max === '1',
      namespace: 'FHIR',
      name: element.type?.[0]?.code,
      modelContext: {
        structureDefinition: sd,
        elementDefinition: element,
        path: propertyPath
      } as FHIRContext
    };
  }
  
  hasProperty(parentType: TypeInfo, propertyName: string): boolean {
    // Check elements map first
    if (parentType.elements) {
      return propertyName in parentType.elements;
    }
    
    // Check model context
    const context = parentType.modelContext as FHIRContext;
    if (!context?.structureDefinition) return false;
    
    const sd = context.structureDefinition;
    const propertyPath = `${sd.type}.${propertyName}`;
    
    return sd.differential.element.some(e => e.path === propertyPath);
  }
  
  getPropertyNames(parentType: TypeInfo): string[] {
    // Use elements map if available
    if (parentType.elements) {
      return Object.keys(parentType.elements);
    }
    
    // Extract from model context
    const context = parentType.modelContext as FHIRContext;
    if (!context?.structureDefinition) return [];
    
    const sd = context.structureDefinition;
    const prefix = `${sd.type}.`;
    
    return sd.differential.element
      .map(e => e.path)
      .filter(path => path.startsWith(prefix) && !path.includes('.', prefix.length))
      .map(path => path.substring(prefix.length));
  }
  
  isTypeCompatible(source: TypeInfo, target: TypeInfo): boolean {
    // Check FHIRPath type compatibility
    if (source.type === target.type && source.singleton === target.singleton) return true;
    
    // Check if source is a union type that includes target
    if (source.union && source.choices) {
      return source.choices.some(choice => this.isTypeCompatible(choice, target));
    }
    
    // Check model-specific compatibility
    if (source.namespace === 'FHIR' && target.namespace === 'FHIR' && source.name && target.name) {
      return this.checkFHIRTypeCompatibility(source.name, target.name);
    }
    
    return false;
  }
  
  mapToFHIRPathType(typeName: string): TypeName {
    // Map FHIR types to FHIRPath types
    const mapping: Record<string, TypeName> = {
      'string': 'String',
      'boolean': 'Boolean',
      'integer': 'Integer',
      'decimal': 'Decimal',
      'date': 'Date',
      'dateTime': 'DateTime',
      'time': 'Time',
      'Quantity': 'Quantity'
    };
    
    return mapping[typeName] || 'Any';
  }
  
  private createUnionType(element: ElementDefinition, path: string, sd: StructureDefinition): TypeInfo {
    const choices: TypeInfo[] = element.type!.map(typeRef => ({
      type: this.mapToFHIRPathType(typeRef.code),
      singleton: element.max === '1',
      namespace: 'FHIR',
      name: typeRef.code
    }));
    
    return {
      type: 'Any',
      union: true,
      singleton: element.max === '1',
      namespace: 'FHIR',
      name: path,
      choices,
      modelContext: {
        structureDefinition: sd,
        elementDefinition: element,
        path
      } as FHIRContext
    };
  }
  
  private buildElementsMap(sd: StructureDefinition): Record<string, TypeInfo> | undefined {
    const elements: Record<string, TypeInfo> = {};
    const prefix = `${sd.type}.`;
    
    sd.differential.element
      .filter(e => e.path.startsWith(prefix) && !e.path.includes('.', prefix.length))
      .forEach(element => {
        const propertyName = element.path.substring(prefix.length);
        
        // Handle choice types
        if (element.type && element.type.length > 1) {
          elements[propertyName] = this.createUnionType(element, element.path, sd);
        } else {
          elements[propertyName] = {
            type: this.mapElementToFHIRPathType(element),
            singleton: element.max === '1',
            namespace: 'FHIR',
            name: element.type?.[0]?.code
          };
        }
      });
    
    return Object.keys(elements).length > 0 ? elements : undefined;
  }
  
  private mapElementToFHIRPathType(element: ElementDefinition): TypeName {
    if (!element.type || element.type.length === 0) return 'Any';
    
    const firstType = element.type[0].code;
    return this.mapToFHIRPathType(firstType);
  }
  
  private checkFHIRTypeCompatibility(source: string, target: string): boolean {
    // Implement FHIR type hierarchy checking
    // For example: Duration is compatible with Quantity
    const compatibilities: Record<string, string[]> = {
      'Duration': ['Quantity'],
      'SimpleQuantity': ['Quantity'],
      'Money': ['Quantity']
    };
    
    return compatibilities[source]?.includes(target) || false;
  }
}

// Usage in analyzer
function analyzeNavigation(
  currentType: TypeInfo, 
  propertyName: string,
  provider: ModelTypeProvider
): TypeInfo {
  const nextType = provider.navigateProperty(currentType, propertyName);
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

- **Model awareness**: FHIRPath engine understands the data model
- **Better validation**: Can catch errors like invalid property access
- **Enhanced IDE support**: Autocomplete, hover, and navigation
- **Type safety**: Can validate type casts and membership tests
- **Extensibility**: Works with any data model (FHIR, CDA, custom)
- **Better errors**: Model-specific error messages
- **Performance**: Can optimize based on type information
- **Black box design**: Model internals are opaque to FHIRPath engine
- **Flexibility**: Model providers can use any internal representation
- **Context preservation**: Type context flows naturally through navigation

### Negative

- **Complexity**: Additional interface to implement
- **Coupling**: Creates dependency between engine and model
- **Maintenance**: Model providers need updates when models change
- **Memory**: Storing model metadata can be memory intensive
- **Performance**: Type lookups add overhead during analysis
- **Opaque handles**: Debugging may be harder with opaque type references

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
- Define the ModelTypeProvider interface
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

## Summary: Benefits of the TypeInfo-Based Design

The TypeInfo-based design provides several key advantages:

1. **Unified Type System**: Single structure handles both FHIRPath primitives and complex model types
2. **Union Type Support**: Native handling of choice types through the `union` flag and `choices` array
3. **Efficient Navigation**: The `elements` map enables property resolution without full model loading
4. **Dual Type Preservation**: Maintains both computational types and model-specific information
5. **Progressive Enhancement**: Can start with basic types and add model information incrementally
6. **Type Safety**: The opaque `modelContext` maintains detailed type information without exposing implementation
7. **Extensibility**: New models can be supported by implementing the interface with TypeInfo

The integration with ADR-005's TypeInfo structure creates a coherent type system that spans from FHIRPath operations through model navigation while maintaining clean separation of concerns.

## References

- FHIR Structure Definitions
- FHIRPath Specification Section 3.1 (Path Selection)
- Language Server Protocol - Completion and Hover
- TypeScript Language Service API
- ADR-003: Type-Enriched AST (for analyzer integration)