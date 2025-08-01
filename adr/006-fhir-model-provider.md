# ADR-006: FHIR ModelProvider Implementation

## Status

Proposed

## Context

The FHIRPath engine needs model awareness to provide type validation, property navigation, and better error messages when working with FHIR resources. ADR-004 established the ModelProvider interface, and we've validated the design with a mock implementation.

Now we need to implement a production-ready FHIR ModelProvider that can:
1. Load and manage FHIR StructureDefinitions
2. Provide type information for FHIRPath navigation
3. Handle FHIR-specific concepts like choice types, extensions, and profiles
4. Integrate with existing FHIR tooling

We have two powerful libraries available:
- **@atomic-ehr/fhirschema**: Converts StructureDefinitions to a simplified FHIRSchema format
- **@atomic-ehr/fhir-canonical-manager**: Manages FHIR packages and resolves canonical URLs

## Decision

Implement a FHIR ModelProvider that leverages both libraries to provide comprehensive FHIR model support for the FHIRPath engine.

### Architecture Overview

```typescript
interface FHIRModelContext {
  // Path in the resource (e.g., "Patient.name.given")
  path: string;
  
  // FHIRSchema for the current type and its ancestors
  schemaHierarchy: FHIRSchema[];
  
  // For union types (choice types)
  isUnion?: boolean;
  choices?: Array<{
    type: TypeName;
    code: string;  // FHIR type code
    schema?: FHIRSchema;
  }>;
  
  // Reference to the source schema
  canonicalUrl?: string;
  version?: string;
}

export class FHIRModelProvider implements ModelProvider<FHIRModelContext> {
  private canonicalManager: CanonicalManager;
  private schemaCache: Map<string, FHIRSchema>;
  private typeMapping: Record<string, TypeName>;
  
  constructor(config: FHIRModelProviderConfig) {
    // Initialize canonical manager with FHIR packages
    // Set up type mapping for FHIR primitives
    // Initialize schema cache
  }
  
  async initialize(): Promise<void> {
    // Load FHIR packages via canonical manager
    // Pre-cache common schemas
  }
  
  getType(typeName: string): TypeInfo<FHIRModelContext> | undefined;
  getElementType(parentType: TypeInfo<FHIRModelContext>, propertyName: string): TypeInfo<FHIRModelContext> | undefined;
  ofType(type: TypeInfo<FHIRModelContext>, typeName: TypeName): TypeInfo<FHIRModelContext> | undefined;
  getElementNames(parentType: TypeInfo<FHIRModelContext>): string[];
}
```

### Implementation Details

#### 1. Schema Loading and Caching

```typescript
private async loadSchema(typeName: string): Promise<FHIRSchema | undefined> {
  // Check cache first
  if (this.schemaCache.has(typeName)) {
    return this.schemaCache.get(typeName);
  }
  
  // Resolve canonical URL for the type
  const canonicalUrl = this.buildCanonicalUrl(typeName);
  const structureDefinition = await this.canonicalManager.resolve(canonicalUrl);
  
  if (!structureDefinition) {
    return undefined;
  }
  
  // Convert to FHIRSchema
  const schema = translate(structureDefinition);
  this.schemaCache.set(typeName, schema);
  
  return schema;
}
```

#### 2. Type Hierarchy Resolution

```typescript
private async getSchemaHierarchy(schema: FHIRSchema): Promise<FHIRSchema[]> {
  const hierarchy: FHIRSchema[] = [schema];
  let current = schema;
  
  // Walk up the inheritance chain
  while (current.base && current.base !== 'Resource' && current.base !== 'Element') {
    const baseSchema = await this.loadSchema(current.base);
    if (!baseSchema) break;
    
    hierarchy.push(baseSchema);
    current = baseSchema;
  }
  
  return hierarchy;
}
```

#### 3. FHIR Type Mapping

```typescript
private readonly typeMapping: Record<string, TypeName> = {
  // FHIR Primitives to FHIRPath types
  'boolean': 'Boolean',
  'integer': 'Integer',
  'string': 'String',
  'decimal': 'Decimal',
  'uri': 'String',
  'url': 'String',
  'canonical': 'String',
  'base64Binary': 'String',
  'instant': 'DateTime',
  'date': 'Date',
  'dateTime': 'DateTime',
  'time': 'Time',
  'code': 'String',
  'oid': 'String',
  'id': 'String',
  'markdown': 'String',
  'unsignedInt': 'Integer',
  'positiveInt': 'Integer',
  'uuid': 'String',
  'xhtml': 'String',
  
  // FHIR Complex types that map to FHIRPath types
  'Quantity': 'Quantity',
  'SimpleQuantity': 'Quantity',
  'Money': 'Quantity',
  'Duration': 'Quantity'
};
```

#### 4. Choice Type Handling

```typescript
private isChoiceType(element: FHIRSchemaElement): boolean {
  return element.type && Array.isArray(element.type) && element.type.length > 1;
}

private createUnionContext(
  element: FHIRSchemaElement, 
  path: string
): FHIRModelContext {
  const choices = element.type!.map(typeCode => ({
    type: this.mapToFHIRPathType(typeCode),
    code: typeCode,
    schema: undefined  // Lazy load when needed
  }));
  
  return {
    path,
    schemaHierarchy: [],
    isUnion: true,
    choices
  };
}
```

#### 5. Element Navigation

```typescript
async getElementType(
  parentType: TypeInfo<FHIRModelContext>, 
  propertyName: string
): Promise<TypeInfo<FHIRModelContext> | undefined> {
  const context = parentType.modelContext;
  if (!context) return undefined;
  
  // Search through schema hierarchy for the property
  for (const schema of context.schemaHierarchy) {
    const element = schema.elements?.[propertyName];
    if (!element) continue;
    
    const path = `${context.path}.${propertyName}`;
    
    // Handle choice types
    if (this.isChoiceType(element)) {
      return {
        type: 'Any',
        namespace: 'FHIR',
        name: propertyName,
        singleton: element.max === 1,
        modelContext: this.createUnionContext(element, path)
      };
    }
    
    // Handle regular types
    const elementType = Array.isArray(element.type) ? element.type[0] : element.type;
    const fhirpathType = this.mapToFHIRPathType(elementType);
    
    // Load schema for complex types
    let elementSchemaHierarchy: FHIRSchema[] = [];
    if (!this.typeMapping[elementType]) {
      const elementSchema = await this.loadSchema(elementType);
      if (elementSchema) {
        elementSchemaHierarchy = await this.getSchemaHierarchy(elementSchema);
      }
    }
    
    return {
      type: fhirpathType,
      namespace: 'FHIR',
      name: elementType,
      singleton: element.max === 1,
      modelContext: {
        path,
        schemaHierarchy: elementSchemaHierarchy,
        canonicalUrl: schema.url,
        version: schema.version
      }
    };
  }
  
  return undefined;
}
```

### Usage Example

```typescript
// Initialize the provider
const provider = new FHIRModelProvider({
  packages: [
    { name: 'hl7.fhir.r4.core', version: '4.0.1' },
    { name: 'hl7.fhir.us.core', version: '5.0.0' }
  ],
  cacheDir: './fhir-cache'
});

await provider.initialize();

// Use in FHIRPath evaluation
const evaluator = new FHIRPathEvaluator({ modelProvider: provider });

// Navigate through types
const patientType = await provider.getType('Patient');
const nameType = await provider.getElementType(patientType, 'name');
const givenType = await provider.getElementType(nameType, 'given');

// Handle choice types
const observationType = await provider.getType('Observation');
const valueType = await provider.getElementType(observationType, 'value');
// valueType will have isUnion=true in modelContext

const stringValue = await provider.ofType(valueType, 'String');
// Returns TypeInfo for valueString if it exists in the union
```

## Consequences

### Positive

- **Full FHIR Support**: Leverages official FHIR packages and definitions
- **Type Safety**: Proper handling of FHIR type system including choice types
- **Performance**: Caching at multiple levels (canonical manager, schema cache)
- **Extensibility**: Supports profiles and extensions through canonical URLs
- **Maintainability**: Uses well-tested libraries rather than custom parsing
- **Version Support**: Can work with multiple FHIR versions simultaneously

### Negative

- **Async Operations**: Schema loading requires async/await
- **Memory Usage**: Caching schemas in memory
- **Startup Time**: Initial package loading may take time
- **Complexity**: More complex than mock provider due to FHIR requirements

## Implementation Phases

### Phase 1: Basic Implementation
- Set up FHIRModelProvider class structure
- Integrate fhir-canonical-manager for package loading
- Implement primitive type mapping
- Basic getType() implementation

### Phase 2: Schema Integration
- Integrate fhirschema for StructureDefinition conversion
- Implement schema caching
- Add hierarchy resolution
- Complete getElementType() implementation

### Phase 3: Advanced Features
- Choice type handling with ofType()
- Extension support
- Profile constraint validation
- Slice handling

### Phase 4: Optimization
- Lazy loading strategies
- Memory usage optimization
- Startup performance improvements
- Pre-compiled schema bundles

## Alternatives Considered

### 1. Direct StructureDefinition Parsing
Parse StructureDefinitions directly without fhirschema conversion.
- **Pros**: More control, no conversion overhead
- **Cons**: Complex implementation, reinventing the wheel

### 2. Static Code Generation
Generate TypeScript types from FHIR definitions at build time.
- **Pros**: Type-safe, no runtime overhead
- **Cons**: Large code size, inflexible, version-specific

### 3. Runtime Download
Download schemas on-demand from a FHIR server.
- **Pros**: Always up-to-date, minimal local storage
- **Cons**: Network dependency, latency, offline limitations

## References

- ADR-004: Model Provider Interface
- @atomic-ehr/fhirschema documentation
- @atomic-ehr/fhir-canonical-manager documentation
- FHIR StructureDefinition specification
- FHIRPath specification section on type checking