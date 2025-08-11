import type { ModelProvider, TypeInfo, TypeName } from './types';
import { CanonicalManager as createCanonicalManager, type Config, type CanonicalManager as ICanonicalManager, type Resource } from '@atomic-ehr/fhir-canonical-manager';
import { translate, type FHIRSchema, type StructureDefinition } from '@atomic-ehr/fhirschema';

export interface FHIRModelContext {
  // Path in the resource (e.g., "Patient.name.given")
  path: string;
  
  // FHIRSchema for the current type and its ancestors
  schemaHierarchy: FHIRSchema[];
  
  // For union types (choice types)
  isUnion?: boolean;
  choices?: Array<{
    type: TypeName;
    code: string;  // FHIR type code
    choiceName?: string;  // The actual element name (e.g., valueString)
    schema?: FHIRSchema;
  }>;
  
  // Reference to the source schema
  canonicalUrl?: string;
  version?: string;
}

export interface FHIRModelProviderConfig {
  packages: Array<{ name: string; version: string }>;
  cacheDir?: string;
  registryUrl?: string;
}

/**
 * FHIR ModelProvider implementation
 * 
 * Note: This provider requires async initialization before use.
 * Call initialize() before using the synchronous methods.
 * 
 * For best performance, pre-load common types during initialization.
 */
export class FHIRModelProvider implements ModelProvider<FHIRModelContext> {
  private canonicalManager: ICanonicalManager;
  private schemaCache: Map<string, FHIRSchema> = new Map();
  private hierarchyCache: Map<string, FHIRSchema[]> = new Map();
  private initialized = false;
  
  // Caches for discovered types
  private complexTypesCache?: string[];
  private primitiveTypesCache?: string[];
  private resourceTypesCache?: string[];
  
  // FHIR Primitives to FHIRPath types mapping
  private readonly typeMapping: Record<string, TypeName> = {
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
    'Duration': 'Quantity',
    'Age': 'Quantity',
    'Distance': 'Quantity',
    'Count': 'Quantity'
  };
  
  // Map FHIR primitive names to FHIRPath type names
  private readonly primitiveTypeMapping: Record<string, string> = {
    'boolean': 'Boolean',
    'string': 'String',
    'integer': 'Integer',
    'decimal': 'Decimal',
    'date': 'Date',
    'dateTime': 'DateTime',
    'time': 'Time',
    'instant': 'Instant',
    'base64Binary': 'Base64Binary',
    'uri': 'Uri',
    'url': 'Url',
    'canonical': 'Canonical',
    'code': 'Code',
    'oid': 'Oid',
    'id': 'Id',
    'markdown': 'Markdown',
    'unsignedInt': 'UnsignedInt',
    'positiveInt': 'PositiveInt',
    'uuid': 'Uuid',
    'xhtml': 'Xhtml'
  };
  
  constructor(private config: FHIRModelProviderConfig = {
    packages: [{ name: 'hl7.fhir.r4.core', version: '4.0.1' }]
  }) {
    const canonicalConfig: Config = {
      packages: config.packages.map(p => `${p.name}@${p.version}`),
      workingDir: config.cacheDir || './tmp/.fhir-cache'
    };
    
    if (config.registryUrl) {
      canonicalConfig.registry = config.registryUrl;
    }
    
    this.canonicalManager = createCanonicalManager(canonicalConfig);
  }
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await this.canonicalManager.init();
      
      // Just discover type names for completions - schemas load lazily on demand
      await Promise.all([
        this.getResourceTypes(),
        this.getComplexTypes(),
        this.getPrimitiveTypes()
      ]);
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize FHIRModelProvider:', error);
      // Mark as initialized even on failure to prevent repeated attempts
      // The provider will work in degraded mode (primitives only)
      this.initialized = true;
    }
  }
  
  private buildCanonicalUrl(typeName: string): string {
    // For R4 core types
    return `http://hl7.org/fhir/StructureDefinition/${typeName}`;
  }
  
  // Public method to get schema with automatic caching
  async getSchema(typeName: string): Promise<FHIRSchema | undefined> {
    // Check cache first
    if (this.schemaCache.has(typeName)) {
      return this.schemaCache.get(typeName);
    }
    
    try {
      // Resolve canonical URL for the type
      const canonicalUrl = this.buildCanonicalUrl(typeName);
      const resource = await this.canonicalManager.resolve(canonicalUrl);
      if (!resource || resource.resourceType !== 'StructureDefinition') {
        return undefined;
      }
      const structureDefinition = resource as unknown as StructureDefinition;
      
      // Convert to FHIRSchema
      const schema = translate(structureDefinition);
      this.schemaCache.set(typeName, schema);
      
      // Pre-cache the hierarchy
      await this.getSchemaHierarchyAsync(schema);
      
      return schema;
    } catch (error) {
      console.warn(`Failed to load schema for ${typeName}:`, error);
      return undefined;
    }
  }
  
  private async getSchemaHierarchyAsync(schema: FHIRSchema): Promise<FHIRSchema[]> {
    const cacheKey = schema.name || schema.url;
    
    // Check cache
    if (this.hierarchyCache.has(cacheKey)) {
      return this.hierarchyCache.get(cacheKey)!;
    }
    
    const hierarchy: FHIRSchema[] = [schema];
    let current = schema;
    
    // Walk up the inheritance chain
    while (current.base && current.base !== 'Resource' && current.base !== 'Element') {
      // Extract just the type name from the base URL if it's a full URL
      let baseTypeName = current.base;
      if (baseTypeName && baseTypeName.startsWith('http://')) {
        const parts = baseTypeName.split('/');
        baseTypeName = parts[parts.length - 1] || baseTypeName;
      }
      
      const baseSchema = await this.getSchema(baseTypeName);
      if (!baseSchema) break;
      
      hierarchy.push(baseSchema);
      current = baseSchema;
    }
    
    this.hierarchyCache.set(cacheKey, hierarchy);
    return hierarchy;
  }
  
  private extractTypeName(url: string): string {
    // Extract type name from FHIR structure definition URL
    // e.g., "http://hl7.org/fhir/StructureDefinition/Element" -> "Element"
    const parts = url.split('/');
    return parts[parts.length - 1] || url;
  }
  
  private getSchemaHierarchyCached(schema: FHIRSchema): FHIRSchema[] {
    const cacheKey = schema.name || schema.url;
    const cached = this.hierarchyCache.get(cacheKey);
    if (cached) return cached;
    
    // If not cached, build the hierarchy synchronously from cached schemas
    const hierarchy: FHIRSchema[] = [schema];
    let current = schema;
    
    while (current.base) {
      const baseTypeName = this.extractTypeName(current.base);
      const baseSchema = this.schemaCache.get(baseTypeName);
      if (!baseSchema) break;
      
      hierarchy.push(baseSchema);
      current = baseSchema;
    }
    
    // Cache for future use
    this.hierarchyCache.set(cacheKey, hierarchy);
    return hierarchy;
  }
  
  private mapToFHIRPathType(fhirType: string): TypeName {
    // If it's a mapped type (primitive or special types), use the mapping
    if (this.typeMapping[fhirType]) {
      return this.typeMapping[fhirType];
    }
    // Otherwise, keep the FHIR type name (for complex types like CodeableConcept)
    return fhirType as TypeName;
  }
  
  private isChoiceType(element: any): boolean {
    return element.type && Array.isArray(element.type) && element.type.length > 1;
  }
  
  private createUnionContext( element: any, path: string, parentSchema: FHIRSchema): FHIRModelContext {
    // Map choice names to their types
    const choices = element.choices.map((choiceName: string) => {
      // Get the actual element for this choice
      const choiceElement = parentSchema.elements?.[choiceName];
      const choiceType = choiceElement?.type || 'Any';
      
      return {
        type: this.mapToFHIRPathType(choiceType),
        code: choiceType,
        choiceName: choiceName
      };
    });
    
    return {
      path,
      schemaHierarchy: [],
      isUnion: true,
      choices,
      canonicalUrl: parentSchema.url,
      version: parentSchema.version
    };
  }
  
  // Async implementation with lazy loading
  async getType(typeName: string): Promise<TypeInfo<FHIRModelContext> | undefined> {
    // Check if it's a primitive type - these don't require initialization
    if (this.typeMapping[typeName]) {
      return {
        type: this.typeMapping[typeName],
        namespace: 'FHIR',
        name: typeName,
        singleton: true,
        modelContext: {
          path: typeName,
          schemaHierarchy: []
        }
      };
    }
    
    // Complex types require initialization
    if (!this.initialized) {
      console.warn('FHIRModelProvider not initialized. Only primitive types available.');
      return undefined;
    }
    
    // Try to load schema lazily
    const schema = await this.getSchema(typeName);
    if (!schema) {
      // Schema not found - this is expected for non-type identifiers
      return undefined;
    }
    
    const schemaHierarchy = await this.getSchemaHierarchyAsync(schema);
    
    return {
      type: 'Any',  // Complex types are 'Any' in FHIRPath
      namespace: 'FHIR',
      name: typeName,
      singleton: true,
      modelContext: {
        path: typeName,
        schemaHierarchy,
        canonicalUrl: schema.url,
        version: schema.version
      }
    };
  }
  
  async getElementType( parentType: TypeInfo<FHIRModelContext>, propertyName: string): Promise<TypeInfo<FHIRModelContext> | undefined> {
    const context = parentType.modelContext;
    if (!context) return undefined;
    
    // Search through schema hierarchy for the property
    for (const schema of context.schemaHierarchy) {
      const element = schema.elements?.[propertyName];
      if (!element) continue;
      
      const path = `${context.path}.${propertyName}`;
      
      // Handle choice types - check if element has choices array
      if (element.choices && Array.isArray(element.choices)) {
        return {
          type: 'Any',
          namespace: 'FHIR',
          name: propertyName,
          singleton: !element.array,
          modelContext: this.createUnionContext(element, path, schema)
        };
      }
      
      // Handle regular types
      const elementType = Array.isArray(element.type) ? element.type[0] : element.type;
      const fhirpathType = this.mapToFHIRPathType(elementType);
      
      // Load schema from cache for complex types
      let elementSchemaHierarchy: FHIRSchema[] = [];
      
      // Special handling for BackboneElement - it has inline elements
      if (elementType === 'BackboneElement' && element.elements) {
        // Create a synthetic schema for the inline BackboneElement
        const inlineSchema: FHIRSchema = {
          name: `${schema.name}.${propertyName}`,
          type: 'BackboneElement',
          url: `${schema.url}#${propertyName}`,
          version: schema.version,
          kind: 'complex-type',
          class: 'complex-type',
          elements: element.elements,
          base: 'BackboneElement'
        } as FHIRSchema;
        elementSchemaHierarchy = [inlineSchema];
      } else if (!this.typeMapping[elementType]) {
        // For complex types, we need to load the schema and its hierarchy
        const elementSchema = await this.getSchema(elementType);
        if (elementSchema) {
          elementSchemaHierarchy = await this.getSchemaHierarchyAsync(elementSchema);
        }
      }
      
      return {
        type: fhirpathType,
        namespace: 'FHIR',
        name: elementType,
        singleton: !element.array,
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
  
  ofType(
    type: TypeInfo<FHIRModelContext>,
    typeName: TypeName
  ): TypeInfo<FHIRModelContext> | undefined {
    const context = type.modelContext;
    
    // Handle union types
    if (context?.isUnion && context?.choices) {
      for (const choice of context.choices) {
        if (choice.type === typeName) {
          return {
            type: choice.type,
            namespace: 'FHIR',
            name: choice.code,
            singleton: type.singleton,
            modelContext: {
              path: context.path + `[${choice.code}]`,
              schemaHierarchy: [],
              canonicalUrl: context.canonicalUrl,
              version: context.version
            }
          };
        }
      }
      return undefined;
    }
    
    // For non-union types, check if the type matches or is a subtype
    // First check direct match on FHIRPath type
    if (type.type === typeName) {
      return type;
    }
    
    // Check if the type name matches
    if (type.name === typeName) {
      return type;
    }
    
    // Check if any of the schemas in the hierarchy match
    if (context?.schemaHierarchy) {
      for (const schema of context.schemaHierarchy) {
        if (schema.type === typeName || schema.name === typeName) {
          return type;
        }
      }
    }
    
    return undefined;
  }
  
  getElementNames(parentType: TypeInfo<FHIRModelContext>): string[] {
    const context = parentType.modelContext;
    if (!context) return [];
    
    const names: Set<string> = new Set();
    
    // Collect properties from all schemas in hierarchy
    for (const schema of context.schemaHierarchy) {
      if (schema.elements) {
        // Filter out choice-specific elements (e.g., deceasedBoolean when deceased exists)
        Object.keys(schema.elements).forEach(name => {
          const element = schema.elements![name];
          if (element && !element.choiceOf) {
            names.add(name);
          }
        });
      }
    }
    
    return Array.from(names);
  }

  async getChildrenType(parentType: TypeInfo<FHIRModelContext>): Promise<TypeInfo<FHIRModelContext> | undefined> {
    const elementNames = this.getElementNames(parentType);
    if (elementNames.length === 0) return undefined;
    
    // Collect all unique child types
    const childTypes = new Map<string, TypeInfo<FHIRModelContext>>();
    
    for (const elementName of elementNames) {
      const elementType = await this.getElementType(parentType, elementName);
      if (elementType) {
        // Use a combination of namespace and name as key to deduplicate
        const key = `${elementType.namespace || ''}.${elementType.name || elementType.type}`;
        childTypes.set(key, elementType);
      }
    }
    
    if (childTypes.size === 0) return undefined;
    
    // Create a union type representing all possible children
    return {
      type: 'Any',
      namespace: parentType.namespace,
      name: 'ChildrenUnion',
      singleton: false, // children() always returns a collection
      modelContext: {
        path: `${parentType.modelContext?.path || ''}.children()`,
        schemaHierarchy: [],
        isUnion: true,
        choices: Array.from(childTypes.values()).map(type => ({
          type: type.type as TypeName,
          code: type.name || type.type,
          namespace: type.namespace,
          modelContext: type.modelContext
        }))
      } as FHIRModelContext
    };
  }
  
  // Async helper methods for loading additional schemas
  async loadType(typeName: string): Promise<TypeInfo<FHIRModelContext> | undefined> {
    await this.getSchema(typeName);
    return this.getType(typeName);
  }

  // Get detailed information about elements of a type
  async getElements(typeName: string): Promise<Array<{ name: string; type: string; documentation?: string }>> {
    if (!this.initialized) {
      console.warn('FHIRModelProvider not initialized. Cannot get elements.');
      return [];
    }

    // Load schema lazily using the public getSchema method
    const schema = await this.getSchema(typeName);
    if (!schema || !schema.elements) {
      return [];
    }

    const elements: Array<{ name: string; type: string; documentation?: string }> = [];
    
    // Get all elements from this schema and its hierarchy
    const schemaHierarchy = await this.getSchemaHierarchyAsync(schema);
    const addedElements = new Set<string>();
    
    for (const currentSchema of schemaHierarchy) {
      if (currentSchema.elements) {
        for (const [elementName, element] of Object.entries(currentSchema.elements)) {
          // Skip choice-specific elements and already added elements
          if (element && !element.choiceOf && !addedElements.has(elementName)) {
            const elementType = Array.isArray(element.type) ? element.type[0] : element.type;
            elements.push({
              name: elementName,
              type: elementType + (element.array ? '[]' : ''),
              documentation: element.short
            });
            addedElements.add(elementName);
          }
        }
      }
    }
    
    return elements;
  }
  
  async getResourceTypes(): Promise<string[]> {
    if (this.resourceTypesCache) {
      return this.resourceTypesCache;
    }
    
    const resources = await this.canonicalManager.search({ 
      kind: 'resource' 
    });
    
    this.resourceTypesCache = resources
      .filter(r => r.resourceType === 'StructureDefinition')
      .map(r => (r as unknown as StructureDefinition).name)
      .filter((name): name is string => !!name)
      .sort();
      
    return this.resourceTypesCache;
  }
  
  async getComplexTypes(): Promise<string[]> {
    if (this.complexTypesCache) {
      return this.complexTypesCache;
    }
    
    const resources = await this.canonicalManager.search({ 
      kind: 'complex-type' 
    });
    
    this.complexTypesCache = resources
      .filter(r => r.resourceType === 'StructureDefinition')
      .map(r => r as unknown as StructureDefinition)
      .filter(sd => {
        // Only include base complex types, not extensions or constraints
        return sd.type !== 'Extension' &&
               sd.derivation !== 'constraint' &&
               !sd.name?.includes('.') && // Skip nested types
               (!sd.abstract || sd.name === 'BackboneElement'); // Keep BackboneElement
      })
      .map(sd => sd.name)
      .filter((name): name is string => !!name)
      .sort();
      
    return this.complexTypesCache;
  }
  
  async getPrimitiveTypes(): Promise<string[]> {
    if (this.primitiveTypesCache) {
      return this.primitiveTypesCache;
    }
    
    const resources = await this.canonicalManager.search({ 
      kind: 'primitive-type' 
    });
    
    // Get FHIR primitive names and map to FHIRPath names
    const fhirPrimitives = resources
      .filter(r => r.resourceType === 'StructureDefinition')
      .map(r => (r as unknown as StructureDefinition).name)
      .filter((name): name is string => !!name);
    
    this.primitiveTypesCache = fhirPrimitives
      .map(name => this.primitiveTypeMapping[name] || name)
      .sort();
      
    return this.primitiveTypesCache;
  }

  // Synchronous method to get type from cache (for analyzer)
  getTypeFromCache(typeName: string): TypeInfo<FHIRModelContext> | undefined {
    // Check if it's a primitive type - these don't require initialization
    if (this.typeMapping[typeName]) {
      return {
        type: this.typeMapping[typeName],
        namespace: 'FHIR',
        name: typeName,
        singleton: true,
        modelContext: {
          path: typeName,
          schemaHierarchy: []
        }
      };
    }
    
    // For complex types, check if schema is in cache
    const schema = this.schemaCache.get(typeName);
    if (!schema) {
      return undefined;
    }
    
    // Get cached hierarchy or at least the current schema
    const schemaHierarchy = this.hierarchyCache.get(schema.name || schema.url) || [schema];
    
    return {
      type: 'Any',  // Complex types are 'Any' in FHIRPath
      namespace: 'FHIR',
      name: typeName,
      singleton: true,
      modelContext: {
        path: typeName,
        schemaHierarchy,
        canonicalUrl: schema.url,
        version: schema.version
      }
    };
  }
}