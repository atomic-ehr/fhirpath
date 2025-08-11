import { describe, it, expect, beforeAll } from 'bun:test';
import { FHIRModelProvider } from '../src/model-provider';

describe('FHIR ModelProvider', () => {
  let provider: FHIRModelProvider;
  
  beforeAll(async () => {
    provider = new FHIRModelProvider({
      packages: [
        { name: 'hl7.fhir.r4.core', version: '4.0.1' }
      ],
      cacheDir: './tmp/.test-fhir-cache',
      registryUrl: 'https://fs.get-ig.org/pkgs'
    });
    
    // Initialize the provider (this will download packages and preload common types)
    try {
      await provider.initialize();
      
      // Load schemas that will be used in synchronous tests
      // These need to be loaded for getTypeFromCache to work
      await Promise.all([
        provider.getSchema('Patient'),
        provider.getSchema('Observation'),
        provider.getSchema('HumanName'),
        provider.getSchema('CodeableConcept'),
        provider.getSchema('Coding'),
        provider.getSchema('Identifier')
      ]);
    } catch (error) {
      // console.error('Failed to initialize model provider in test:', error);
    }
  });
  
  describe('getType', () => {
    it('should return type info for FHIR primitive types', async () => {
      const stringType = await provider.getType('string');
      expect(stringType).toBeDefined();
      expect(stringType?.type).toBe('String');
      expect(stringType?.namespace).toBe('FHIR');
      expect(stringType?.singleton).toBe(true);
      
      const booleanType = await provider.getType('boolean');
      expect(booleanType?.type).toBe('Boolean');
      
      const dateType = await provider.getType('date');
      expect(dateType?.type).toBe('Date');
      
      const dateTimeType = await provider.getType('dateTime');
      expect(dateTimeType?.type).toBe('DateTime');
    });
    
    it('should return type info for FHIR complex types', async () => {
      const patientType = await provider.getType('Patient');
      expect(patientType).toBeDefined();
      expect(patientType?.type).toBe('Any'); // Complex types are 'Any'
      expect(patientType?.namespace).toBe('FHIR');
      expect(patientType?.name).toBe('Patient');
      expect(patientType?.modelContext?.schemaHierarchy).toBeDefined();
      expect(patientType?.modelContext?.schemaHierarchy.length).toBeGreaterThan(0);
    });
    
    it('should return undefined for unknown types', async () => {
      const unknownType = await provider.getType('UnknownType');
      expect(unknownType).toBeUndefined();
    });
    
    it('should handle Quantity-like types', async () => {
      const quantityType = await provider.getType('Quantity');
      expect(quantityType?.type).toBe('Quantity');
      
      const ageType = await provider.getType('Age');
      expect(ageType?.type).toBe('Quantity');
      
      const durationType = await provider.getType('Duration');
      expect(durationType?.type).toBe('Quantity');
    });
  });
  
  describe('getElementType', () => {
    it('should navigate to simple properties', async () => {
      const patientType = provider.getTypeFromCache('Patient')!;
      
      // Patient.id (from Resource)
      const idType = await provider.getElementType(patientType, 'id');
      expect(idType).toBeDefined();
      expect(idType?.type).toBe('String');
      expect(idType?.singleton).toBe(true);
      
      // Patient.active
      const activeType = await provider.getElementType(patientType, 'active');
      expect(activeType).toBeDefined();
      expect(activeType?.type).toBe('Boolean');
      expect(activeType?.singleton).toBe(true);
      
      // Patient.name
      const nameType = await provider.getElementType(patientType, 'name');
      expect(nameType).toBeDefined();
      expect(nameType?.type).toBe('HumanName' as any); // Complex type name is preserved
      expect(nameType?.name).toBe('HumanName');
      expect(nameType?.singleton).toBe(false); // name is an array
    });
    
    it('should navigate nested properties', async () => {
      const patientType = provider.getTypeFromCache('Patient')!;
      const nameType = await provider.getElementType(patientType, 'name')!;
      
      // HumanName.given
      const givenType = await provider.getElementType(nameType!, 'given');
      expect(givenType).toBeDefined();
      expect(givenType?.type).toBe('String');
      expect(givenType?.singleton).toBe(false); // given is an array
      
      // HumanName.family
      const familyType = await provider.getElementType(nameType!, 'family');
      expect(familyType).toBeDefined();
      expect(familyType?.type).toBe('String');
      expect(familyType?.singleton).toBe(true);
    });
    
    it('should handle choice types', async () => {
      const observationType = provider.getTypeFromCache('Observation')!;
      const valueType = await provider.getElementType(observationType, 'value');
      
      expect(valueType).toBeDefined();
      expect(valueType?.type).toBe('Any'); // Union types are 'Any'
      expect(valueType?.modelContext?.isUnion).toBe(true);
      expect(valueType?.modelContext?.choices).toBeDefined();
      expect(valueType?.modelContext?.choices?.length).toBeGreaterThan(0);
      
      // Check some common value[x] choices
      const hasString = valueType?.modelContext?.choices?.some(c => c.type === 'String');
      const hasQuantity = valueType?.modelContext?.choices?.some(c => c.type === 'Quantity');
      const hasBoolean = valueType?.modelContext?.choices?.some(c => c.type === 'Boolean');
      
      expect(hasString).toBe(true);
      expect(hasQuantity).toBe(true);
      expect(hasBoolean).toBe(true);
    });
    
    it('should return undefined for unknown properties', async () => {
      const patientType = provider.getTypeFromCache('Patient')!;
      const unknownType = await provider.getElementType(patientType, 'unknownProperty');
      
      expect(unknownType).toBeUndefined();
    });
    
    it('should handle properties from base types', async () => {
      const patientType = provider.getTypeFromCache('Patient')!;
      
      // From Resource
      const metaType = await provider.getElementType(patientType, 'meta');
      expect(metaType).toBeDefined();
      expect(metaType?.name).toBe('Meta');
      
      // From DomainResource
      const textType = await provider.getElementType(patientType, 'text');
      expect(textType).toBeDefined();
      expect(textType?.name).toBe('Narrative');
    });
  });
  
  describe('ofType', () => {
    it('should filter union types to specific choice', async () => {
      const observationType = provider.getTypeFromCache('Observation')!;
      const valueType = await provider.getElementType(observationType, 'value')!;
      
      // Filter to String
      const stringValue = provider.ofType(valueType!, 'String');
      expect(stringValue).toBeDefined();
      expect(stringValue?.type).toBe('String');
      expect(stringValue?.name).toBe('string');
      
      // Filter to Quantity
      const quantityValue = provider.ofType(valueType!, 'Quantity');
      expect(quantityValue).toBeDefined();
      expect(quantityValue?.type).toBe('Quantity');
      
      // Filter to Boolean
      const booleanValue = provider.ofType(valueType!, 'Boolean');
      expect(booleanValue).toBeDefined();
      expect(booleanValue?.type).toBe('Boolean');
      
      // Filter to non-existent type
      const decimalValue = provider.ofType(valueType!, 'Decimal');
      expect(decimalValue).toBeUndefined(); // Observation.value doesn't have decimal option
    });
    
    it('should return type if it matches for non-union types', async () => {
      const patientType = provider.getTypeFromCache('Patient')!;
      const idType = await provider.getElementType(patientType, 'id')!;
      
      const stringType = provider.ofType(idType!, 'String');
      expect(stringType).toBeDefined();
      expect(stringType?.type).toBe('String');
      
      const booleanType = provider.ofType(idType!, 'Boolean');
      expect(booleanType).toBeUndefined();
    });
  });
  
  describe('getElementNames', () => {
    it('should return all element names including inherited ones', async () => {
      const patientType = provider.getTypeFromCache('Patient')!;
      const elementNames = provider.getElementNames(patientType);
      
      expect(elementNames).toBeDefined();
      expect(elementNames.length).toBeGreaterThan(0);
      
      // From Patient
      expect(elementNames).toContain('active');
      expect(elementNames).toContain('name');
      expect(elementNames).toContain('gender');
      expect(elementNames).toContain('birthDate');
      
      // From DomainResource
      expect(elementNames).toContain('text');
      expect(elementNames).toContain('contained');
      expect(elementNames).toContain('extension');
      
      // From Resource
      expect(elementNames).toContain('id');
      expect(elementNames).toContain('meta');
      expect(elementNames).toContain('implicitRules');
    });
    
    it('should return element names for simple complex types', async () => {
      const humanNameType = provider.getTypeFromCache('HumanName')!;
      const elementNames = provider.getElementNames(humanNameType);
      
      expect(elementNames).toContain('use');
      expect(elementNames).toContain('text');
      expect(elementNames).toContain('family');
      expect(elementNames).toContain('given');
      expect(elementNames).toContain('prefix');
      expect(elementNames).toContain('suffix');
      expect(elementNames).toContain('period');
    });
    
    it('should return empty array for primitive types', async () => {
      const stringType = provider.getTypeFromCache('string')!;
      const elementNames = provider.getElementNames(stringType);
      
      expect(elementNames).toEqual([]);
    });
  });
  
  describe('loadType', () => {
    it('should be able to load additional types on demand', async () => {
      // Load a type that might not be in the common types list
      const carePlanType = await provider.loadType('CarePlan');
      
      expect(carePlanType).toBeDefined();
      expect(carePlanType?.name).toBe('CarePlan');
      expect(carePlanType?.type).toBe('Any');
      
      // Now it should be available from cache
      const carePlanType2 = provider.getTypeFromCache('CarePlan');
      expect(carePlanType2).toBeDefined();
      expect(carePlanType2?.name).toBe('CarePlan');
    });
  });

  describe('modelProvider', async () => {
    it('should be able to get type info for FHIR primitive types', async () => {
      const observationType = provider.getTypeFromCache('Observation')!;
      const value = await provider.getElementType(observationType, 'value');
      expect(value).toBeDefined();
      const valueType = provider.ofType(value!, 'Quantity');
      expect(valueType?.type).toBe('Quantity');
      const valueType2 = provider.ofType(value!, 'Boolean');
      expect(valueType2?.type).toBe('Boolean');
    });
  });

  describe('Property navigation through complex types', () => {
    it('should navigate from Patient to name to given', async () => {
      // Step 1: Get Patient type
      const patientType = await provider.getType('Patient');
      expect(patientType).toBeDefined();
      expect(patientType?.name).toBe('Patient');
      expect(patientType?.type).toBe('Any');
      
      // Step 2: Navigate to name property (should return HumanName type)
      const nameType = await provider.getElementType(patientType!, 'name');
      expect(nameType).toBeDefined();
      expect(nameType?.name).toBe('HumanName');
      expect(nameType?.type).toBe('HumanName' as any);
      expect(nameType?.singleton).toBe(false); // name is an array
      expect(nameType?.modelContext?.schemaHierarchy).toBeDefined();
      expect(nameType?.modelContext?.schemaHierarchy?.length).toBeGreaterThan(0);
      
      // Verify the HumanName schema has the given element
      const humanNameSchema = nameType?.modelContext?.schemaHierarchy?.[0];
      expect(humanNameSchema).toBeDefined();
      expect(humanNameSchema?.elements).toBeDefined();
      expect(humanNameSchema?.elements?.given).toBeDefined();
      
      // Step 3: Navigate to given property (should return String type)
      const givenType = await provider.getElementType(nameType!, 'given');
      expect(givenType).toBeDefined();
      expect(givenType?.type).toBe('String');
      expect(givenType?.singleton).toBe(false); // given is an array
      expect(givenType?.modelContext?.path).toBe('Patient.name.given');
    });

    it('should navigate through all HumanName properties', async () => {
      const humanNameType = await provider.getType('HumanName');
      expect(humanNameType).toBeDefined();
      
      // Test navigation to each property
      const properties = ['use', 'text', 'family', 'given', 'prefix', 'suffix', 'period'];
      
      for (const prop of properties) {
        const propType = await provider.getElementType(humanNameType!, prop);
        expect(propType).toBeDefined();
        expect(propType?.modelContext?.path).toBe(`HumanName.${prop}`);
        
        // Check expected types
        if (prop === 'period') {
          expect(propType?.type).toBe('Period' as any);
        } else if (prop === 'use') {
          expect(propType?.type).toBe('String'); // code maps to String
        } else {
          expect(propType?.type).toBe('String');
        }
        
        // Check array status
        if (['given', 'prefix', 'suffix'].includes(prop)) {
          expect(propType?.singleton).toBe(false); // arrays
        } else {
          expect(propType?.singleton).toBe(true); // single values
        }
      }
    });

    it('should handle navigation from cached types', async () => {
      // First ensure HumanName is in cache
      await provider.getType('HumanName');
      
      // Now get it from cache
      const humanNameType = provider.getTypeFromCache('HumanName');
      expect(humanNameType).toBeDefined();
      
      // Navigation should still work
      const givenType = await provider.getElementType(humanNameType!, 'given');
      expect(givenType).toBeDefined();
      expect(givenType?.type).toBe('String');
      expect(givenType?.singleton).toBe(false);
    });
  });

  describe('Subtype relationships', () => {
    it('should recognize SimpleQuantity as a subtype of Quantity', async () => {
      const simpleQuantityType = await provider.getType('SimpleQuantity');
      expect(simpleQuantityType).toBeDefined();
      expect(simpleQuantityType?.type).toBe('Quantity'); // Maps to FHIRPath Quantity
      
      // Should recognize SimpleQuantity as Quantity via ofType
      if (simpleQuantityType) {
        const result = provider.ofType(simpleQuantityType, 'Quantity');
        expect(result).toBeDefined();
        expect(result).toBe(simpleQuantityType);
      } else {
        throw new Error('SimpleQuantity type not loaded');
      }
    });

    it('should handle all Quantity subtypes correctly', async () => {
      const subtypes = ['SimpleQuantity', 'Money', 'Duration', 'Age', 'Distance', 'Count'];
      
      for (const subtype of subtypes) {
        const type = await provider.getType(subtype);
        expect(type).toBeDefined();
        expect(type?.type).toBe('Quantity'); // All map to FHIRPath Quantity
        
        // Should be recognized as Quantity
        if (type) {
          const asQuantity = provider.ofType(type, 'Quantity');
          expect(asQuantity).toBeDefined();
          expect(asQuantity).toBe(type);
        }
      }
    });
  });

  describe('BackboneElement handling', () => {
    it('should handle inline BackboneElement definitions', async () => {
      const observationType = await provider.getType('Observation');
      expect(observationType).toBeDefined();
      
      // Get referenceRange which is a BackboneElement
      const referenceRangeType = await provider.getElementType(observationType!, 'referenceRange');
      expect(referenceRangeType).toBeDefined();
      expect(referenceRangeType?.name).toBe('BackboneElement');
      expect(referenceRangeType?.singleton).toBe(false); // It's an array
      
      // Check that it has inline elements in its schema hierarchy
      const inlineSchema = referenceRangeType?.modelContext?.schemaHierarchy?.[0];
      expect(inlineSchema).toBeDefined();
      expect(inlineSchema?.elements).toBeDefined();
      expect(inlineSchema?.elements?.low).toBeDefined();
      expect(inlineSchema?.elements?.high).toBeDefined();
      expect(inlineSchema?.elements?.text).toBeDefined();
    });

    it('should navigate through BackboneElement properties', async () => {
      const observationType = await provider.getType('Observation');
      expect(observationType).toBeDefined();
      
      // Get referenceRange
      const referenceRangeType = await provider.getElementType(observationType!, 'referenceRange');
      expect(referenceRangeType).toBeDefined();
      
      // Navigate to low property
      const lowType = await provider.getElementType(referenceRangeType!, 'low');
      expect(lowType).toBeDefined();
      expect(lowType?.type).toBe('Quantity'); // SimpleQuantity maps to Quantity
      expect(lowType?.name).toBe('Quantity'); // Maps to Quantity in FHIRPath
      expect(lowType?.singleton).toBe(true);
      
      // Navigate to high property
      const highType = await provider.getElementType(referenceRangeType!, 'high');
      expect(highType).toBeDefined();
      expect(highType?.type).toBe('Quantity');
      expect(highType?.name).toBe('Quantity'); // Maps to Quantity in FHIRPath
      expect(highType?.singleton).toBe(true);
      
      // Navigate to text property
      const textType = await provider.getElementType(referenceRangeType!, 'text');
      expect(textType).toBeDefined();
      expect(textType?.type).toBe('String');
      expect(textType?.singleton).toBe(true);
    });

    it('should handle component patterns like ObservationComponentComponent', async () => {
      const observationType = await provider.getType('Observation');
      const componentType = await provider.getElementType(observationType!, 'component');
      expect(componentType).toBeDefined();
      expect(componentType?.name).toBe('BackboneElement');
      expect(componentType?.singleton).toBe(false); // array
      
      // Should have inline elements
      const inlineSchema = componentType?.modelContext?.schemaHierarchy?.[0];
      expect(inlineSchema?.elements).toBeDefined();
      expect(inlineSchema?.elements?.code).toBeDefined();
      expect(inlineSchema?.elements?.value).toBeDefined(); // value[x]
    });
  });

  describe('Schema hierarchy', () => {
    it('should build correct hierarchy for resources', async () => {
      const patientType = await provider.getType('Patient');
      expect(patientType).toBeDefined();
      
      const hierarchy = patientType?.modelContext?.schemaHierarchy;
      expect(hierarchy).toBeDefined();
      expect(hierarchy?.length).toBeGreaterThan(1);
      
      // Should have Patient -> DomainResource -> Resource -> (Base)
      const patientSchema = hierarchy?.[0];
      expect(patientSchema?.name).toBe('Patient');
      expect(patientSchema?.type).toBe('Patient');
      
      // Check for DomainResource in hierarchy
      const hasDomainResource = hierarchy?.some(s => s.type === 'DomainResource' || s.name === 'DomainResource');
      expect(hasDomainResource).toBe(true);
    });

    it('should build correct hierarchy for complex types', async () => {
      const humanNameType = await provider.getType('HumanName');
      expect(humanNameType).toBeDefined();
      
      const hierarchy = humanNameType?.modelContext?.schemaHierarchy;
      expect(hierarchy).toBeDefined();
      expect(hierarchy?.length).toBeGreaterThanOrEqual(1);
      
      const humanNameSchema = hierarchy?.[0];
      expect(humanNameSchema?.name).toBe('HumanName');
    });
  });

  describe('Type discovery', () => {
    it('should discover resource types', async () => {
      const resourceTypes = await provider.getResourceTypes();
      expect(resourceTypes).toBeDefined();
      expect(resourceTypes.length).toBeGreaterThan(0);
      expect(resourceTypes).toContain('Patient');
      expect(resourceTypes).toContain('Observation');
      expect(resourceTypes).toContain('Medication');
      expect(resourceTypes).not.toContain('BackboneElement'); // Not a resource
      expect(resourceTypes).not.toContain('Element'); // Not a resource
    });

    it('should discover complex types', async () => {
      const complexTypes = await provider.getComplexTypes();
      expect(complexTypes).toBeDefined();
      expect(complexTypes.length).toBeGreaterThan(0);
      expect(complexTypes).toContain('HumanName');
      expect(complexTypes).toContain('Address');
      expect(complexTypes).toContain('CodeableConcept');
      expect(complexTypes).toContain('Quantity');
      // SimpleQuantity might not be in the list as it's a profile, not a base type
      // expect(complexTypes).toContain('SimpleQuantity');
      expect(complexTypes).toContain('BackboneElement');
    });

    it('should discover primitive types', async () => {
      const primitiveTypes = await provider.getPrimitiveTypes();
      expect(primitiveTypes).toBeDefined();
      expect(primitiveTypes.length).toBeGreaterThan(0);
      
      // Check for FHIRPath type names (mapped from FHIR primitives)
      expect(primitiveTypes).toContain('String');
      expect(primitiveTypes).toContain('Integer');
      expect(primitiveTypes).toContain('Boolean');
      expect(primitiveTypes).toContain('Date');
      expect(primitiveTypes).toContain('DateTime');
      expect(primitiveTypes).toContain('Decimal');
    });
  });

  describe('getElements', () => {
    it('should return detailed element information', async () => {
      const elements = await provider.getElements('Patient');
      expect(elements).toBeDefined();
      expect(elements.length).toBeGreaterThan(0);
      
      // Check specific elements
      const nameElement = elements.find(e => e.name === 'name');
      expect(nameElement).toBeDefined();
      expect(nameElement?.type).toBe('HumanName[]');
      
      const birthDateElement = elements.find(e => e.name === 'birthDate');
      expect(birthDateElement).toBeDefined();
      expect(birthDateElement?.type).toBe('date');
      
      const activeElement = elements.find(e => e.name === 'active');
      expect(activeElement).toBeDefined();
      expect(activeElement?.type).toBe('boolean');
    });

    it('should include inherited elements', async () => {
      const elements = await provider.getElements('Patient');
      
      // From Resource
      const idElement = elements.find(e => e.name === 'id');
      expect(idElement).toBeDefined();
      
      // From DomainResource
      const textElement = elements.find(e => e.name === 'text');
      expect(textElement).toBeDefined();
    });
  });

  describe('getChildrenType', () => {
    it('should return union type for all children', async () => {
      const patientType = await provider.getType('Patient');
      expect(patientType).toBeDefined();
      
      const childrenType = await provider.getChildrenType(patientType!);
      expect(childrenType).toBeDefined();
      expect(childrenType?.type).toBe('Any');
      expect(childrenType?.singleton).toBe(false); // children() returns collection
      expect(childrenType?.modelContext?.isUnion).toBe(true);
      expect(childrenType?.modelContext?.choices).toBeDefined();
      expect(childrenType?.modelContext?.choices?.length).toBeGreaterThan(0);
    });
  });

  describe('getTypeFromCache', () => {
    it('should return cached types after loading', () => {
      // These were preloaded in beforeAll
      const patientType = provider.getTypeFromCache('Patient');
      expect(patientType).toBeDefined();
      expect(patientType?.name).toBe('Patient');
      
      const observationType = provider.getTypeFromCache('Observation');
      expect(observationType).toBeDefined();
      expect(observationType?.name).toBe('Observation');
    });

    it('should return undefined for non-cached types', () => {
      const uncachedType = provider.getTypeFromCache('UncachedResourceType');
      expect(uncachedType).toBeUndefined();
    });
  });
});