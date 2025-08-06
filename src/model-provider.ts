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
  
  // Common FHIR types to preload - load all resource types and common data types
  private readonly commonTypes = [
    // Base resources
    'Resource', 'DomainResource',
    // All FHIR R4 resources (alphabetical)
    'Account', 'ActivityDefinition', 'AdverseEvent', 'AllergyIntolerance', 'Appointment',
    'AppointmentResponse', 'AuditEvent', 'Basic', 'Binary', 'BiologicallyDerivedProduct',
    'BodyStructure', 'Bundle', 'CapabilityStatement', 'CarePlan', 'CareTeam',
    'CatalogEntry', 'ChargeItem', 'ChargeItemDefinition', 'Claim', 'ClaimResponse',
    'ClinicalImpression', 'CodeSystem', 'Communication', 'CommunicationRequest', 'CompartmentDefinition',
    'Composition', 'ConceptMap', 'Condition', 'Consent', 'Contract',
    'Coverage', 'CoverageEligibilityRequest', 'CoverageEligibilityResponse', 'DetectedIssue', 'Device',
    'DeviceDefinition', 'DeviceMetric', 'DeviceRequest', 'DeviceUseStatement', 'DiagnosticReport',
    'DocumentManifest', 'DocumentReference', 'EffectEvidenceSynthesis', 'Encounter', 'Endpoint',
    'EnrollmentRequest', 'EnrollmentResponse', 'EpisodeOfCare', 'EventDefinition', 'Evidence',
    'EvidenceVariable', 'ExampleScenario', 'ExplanationOfBenefit', 'FamilyMemberHistory', 'Flag',
    'Goal', 'GraphDefinition', 'Group', 'GuidanceResponse', 'HealthcareService',
    'ImagingStudy', 'Immunization', 'ImmunizationEvaluation', 'ImmunizationRecommendation', 'ImplementationGuide',
    'InsurancePlan', 'Invoice', 'Library', 'Linkage', 'List',
    'Location', 'Measure', 'MeasureReport', 'Media', 'Medication',
    'MedicationAdministration', 'MedicationDispense', 'MedicationKnowledge', 'MedicationRequest', 'MedicationStatement',
    'MedicinalProduct', 'MedicinalProductAuthorization', 'MedicinalProductContraindication', 'MedicinalProductIndication', 'MedicinalProductIngredient',
    'MedicinalProductInteraction', 'MedicinalProductManufactured', 'MedicinalProductPackaged', 'MedicinalProductPharmaceutical', 'MedicinalProductUndesirableEffect',
    'MessageDefinition', 'MessageHeader', 'MolecularSequence', 'NamingSystem', 'NutritionOrder',
    'Observation', 'ObservationDefinition', 'OperationDefinition', 'OperationOutcome', 'Organization',
    'OrganizationAffiliation', 'Parameters', 'Patient', 'PaymentNotice', 'PaymentReconciliation',
    'Person', 'PlanDefinition', 'Practitioner', 'PractitionerRole', 'Procedure',
    'Provenance', 'Questionnaire', 'QuestionnaireResponse', 'RelatedPerson', 'RequestGroup',
    'ResearchDefinition', 'ResearchElementDefinition', 'ResearchStudy', 'ResearchSubject', 'RiskAssessment',
    'RiskEvidenceSynthesis', 'Schedule', 'SearchParameter', 'ServiceRequest', 'Slot',
    'Specimen', 'SpecimenDefinition', 'StructureDefinition', 'StructureMap', 'Subscription',
    'Substance', 'SubstanceNucleicAcid', 'SubstancePolymer', 'SubstanceProtein', 'SubstanceReferenceInformation',
    'SubstanceSourceMaterial', 'SubstanceSpecification', 'SupplyDelivery', 'SupplyRequest', 'Task',
    'TerminologyCapabilities', 'TestReport', 'TestScript', 'ValueSet', 'VerificationResult',
    'VisionPrescription',
    // Common data types
    'HumanName', 'CodeableConcept', 'Coding', 'Extension', 'Reference', 
    'Identifier', 'Period', 'ContactPoint', 'Address', 'Attachment', 
    'Meta', 'Narrative', 'Quantity', 'SimpleQuantity', 'Age', 'Distance',
    'Duration', 'Count', 'Money', 'Range', 'Ratio', 'SampledData',
    'Timing', 'Annotation', 'Signature', 'ContactDetail', 'Contributor',
    'DataRequirement', 'ParameterDefinition', 'RelatedArtifact', 'TriggerDefinition',
    'UsageContext', 'Dosage', 'ElementDefinition'
  ];
  
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
      
      // Preload common types with error handling
      const results = await Promise.allSettled(
        this.commonTypes.map(type => this.loadSchemaAsync(type))
      );
      
      // Log any failed loads
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.warn(`Failed to preload ${this.commonTypes[index]}:`, result.reason);
        }
      });
      
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
  
  private async loadSchemaAsync(typeName: string): Promise<FHIRSchema | undefined> {
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
  
  private loadSchemaCached(typeName: string): FHIRSchema | undefined {
    return this.schemaCache.get(typeName);
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
      
      const baseSchema = await this.loadSchemaAsync(baseTypeName);
      if (!baseSchema) break;
      
      hierarchy.push(baseSchema);
      current = baseSchema;
    }
    
    this.hierarchyCache.set(cacheKey, hierarchy);
    return hierarchy;
  }
  
  private getSchemaHierarchyCached(schema: FHIRSchema): FHIRSchema[] {
    const cacheKey = schema.name || schema.url;
    const cached = this.hierarchyCache.get(cacheKey);
    if (cached) return cached;
    
    // If not cached, at least return the current schema
    // This might happen if the schema wasn't pre-loaded during initialization
    return [schema];
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
  
  // Synchronous implementation (requires pre-loaded schemas)
  getType(typeName: string): TypeInfo<FHIRModelContext> | undefined {
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
    
    // Load schema from cache
    const schema = this.loadSchemaCached(typeName);
    if (!schema) {
      // Schema not found - this is expected for non-type identifiers
      return undefined;
    }
    
    const schemaHierarchy = this.getSchemaHierarchyCached(schema);
    
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
  
  getElementType( parentType: TypeInfo<FHIRModelContext>, propertyName: string): TypeInfo<FHIRModelContext> | undefined {
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
        const elementSchema = this.loadSchemaCached(elementType);
        if (elementSchema) {
          elementSchemaHierarchy = this.getSchemaHierarchyCached(elementSchema);
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

  getChildrenType(parentType: TypeInfo<FHIRModelContext>): TypeInfo<FHIRModelContext> | undefined {
    const elementNames = this.getElementNames(parentType);
    if (elementNames.length === 0) return undefined;
    
    // Collect all unique child types
    const childTypes = new Map<string, TypeInfo<FHIRModelContext>>();
    
    for (const elementName of elementNames) {
      const elementType = this.getElementType(parentType, elementName);
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
    await this.loadSchemaAsync(typeName);
    return this.getType(typeName);
  }
}