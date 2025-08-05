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
    } catch (error) {
      // console.error('Failed to initialize model provider in test:', error);
    }
  });
  
  describe('getType', () => {
    it('should return type info for FHIR primitive types', () => {
      const stringType = provider.getType('string');
      expect(stringType).toBeDefined();
      expect(stringType?.type).toBe('String');
      expect(stringType?.namespace).toBe('FHIR');
      expect(stringType?.singleton).toBe(true);
      
      const booleanType = provider.getType('boolean');
      expect(booleanType?.type).toBe('Boolean');
      
      const dateType = provider.getType('date');
      expect(dateType?.type).toBe('Date');
      
      const dateTimeType = provider.getType('dateTime');
      expect(dateTimeType?.type).toBe('DateTime');
    });
    
    it('should return type info for FHIR complex types', () => {
      const patientType = provider.getType('Patient');
      expect(patientType).toBeDefined();
      expect(patientType?.type).toBe('Any'); // Complex types are 'Any'
      expect(patientType?.namespace).toBe('FHIR');
      expect(patientType?.name).toBe('Patient');
      expect(patientType?.modelContext?.schemaHierarchy).toBeDefined();
      expect(patientType?.modelContext?.schemaHierarchy.length).toBeGreaterThan(0);
    });
    
    it('should return undefined for unknown types', () => {
      const unknownType = provider.getType('UnknownType');
      expect(unknownType).toBeUndefined();
    });
    
    it('should handle Quantity-like types', () => {
      const quantityType = provider.getType('Quantity');
      expect(quantityType?.type).toBe('Quantity');
      
      const ageType = provider.getType('Age');
      expect(ageType?.type).toBe('Quantity');
      
      const durationType = provider.getType('Duration');
      expect(durationType?.type).toBe('Quantity');
    });
  });
  
  describe('getElementType', () => {
    it('should navigate to simple properties', () => {
      const patientType = provider.getType('Patient')!;
      
      // Patient.id (from Resource)
      const idType = provider.getElementType(patientType, 'id');
      expect(idType).toBeDefined();
      expect(idType?.type).toBe('String');
      expect(idType?.singleton).toBe(true);
      
      // Patient.active
      const activeType = provider.getElementType(patientType, 'active');
      expect(activeType).toBeDefined();
      expect(activeType?.type).toBe('Boolean');
      expect(activeType?.singleton).toBe(true);
      
      // Patient.name
      const nameType = provider.getElementType(patientType, 'name');
      expect(nameType).toBeDefined();
      expect(nameType?.type).toBe('HumanName' as any); // Complex type name is preserved
      expect(nameType?.name).toBe('HumanName');
      expect(nameType?.singleton).toBe(false); // name is an array
    });
    
    it('should navigate nested properties', () => {
      const patientType = provider.getType('Patient')!;
      const nameType = provider.getElementType(patientType, 'name')!;
      
      // HumanName.given
      const givenType = provider.getElementType(nameType, 'given');
      expect(givenType).toBeDefined();
      expect(givenType?.type).toBe('String');
      expect(givenType?.singleton).toBe(false); // given is an array
      
      // HumanName.family
      const familyType = provider.getElementType(nameType, 'family');
      expect(familyType).toBeDefined();
      expect(familyType?.type).toBe('String');
      expect(familyType?.singleton).toBe(true);
    });
    
    it('should handle choice types', () => {
      const observationType = provider.getType('Observation')!;
      const valueType = provider.getElementType(observationType, 'value');
      
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
    
    it('should return undefined for unknown properties', () => {
      const patientType = provider.getType('Patient')!;
      const unknownType = provider.getElementType(patientType, 'unknownProperty');
      
      expect(unknownType).toBeUndefined();
    });
    
    it('should handle properties from base types', () => {
      const patientType = provider.getType('Patient')!;
      
      // From Resource
      const metaType = provider.getElementType(patientType, 'meta');
      expect(metaType).toBeDefined();
      expect(metaType?.name).toBe('Meta');
      
      // From DomainResource
      const textType = provider.getElementType(patientType, 'text');
      expect(textType).toBeDefined();
      expect(textType?.name).toBe('Narrative');
    });
  });
  
  describe('ofType', () => {
    it('should filter union types to specific choice', () => {
      const observationType = provider.getType('Observation')!;
      const valueType = provider.getElementType(observationType, 'value')!;
      
      // Filter to String
      const stringValue = provider.ofType(valueType, 'String');
      expect(stringValue).toBeDefined();
      expect(stringValue?.type).toBe('String');
      expect(stringValue?.name).toBe('string');
      
      // Filter to Quantity
      const quantityValue = provider.ofType(valueType, 'Quantity');
      expect(quantityValue).toBeDefined();
      expect(quantityValue?.type).toBe('Quantity');
      
      // Filter to Boolean
      const booleanValue = provider.ofType(valueType, 'Boolean');
      expect(booleanValue).toBeDefined();
      expect(booleanValue?.type).toBe('Boolean');
      
      // Filter to non-existent type
      const decimalValue = provider.ofType(valueType, 'Decimal');
      expect(decimalValue).toBeUndefined(); // Observation.value doesn't have decimal option
    });
    
    it('should return type if it matches for non-union types', () => {
      const patientType = provider.getType('Patient')!;
      const idType = provider.getElementType(patientType, 'id')!;
      
      const stringType = provider.ofType(idType, 'String');
      expect(stringType).toBeDefined();
      expect(stringType?.type).toBe('String');
      
      const booleanType = provider.ofType(idType, 'Boolean');
      expect(booleanType).toBeUndefined();
    });
  });
  
  describe('getElementNames', () => {
    it('should return all element names including inherited ones', () => {
      const patientType = provider.getType('Patient')!;
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
    
    it('should return element names for simple complex types', () => {
      const humanNameType = provider.getType('HumanName')!;
      const elementNames = provider.getElementNames(humanNameType);
      
      expect(elementNames).toContain('use');
      expect(elementNames).toContain('text');
      expect(elementNames).toContain('family');
      expect(elementNames).toContain('given');
      expect(elementNames).toContain('prefix');
      expect(elementNames).toContain('suffix');
      expect(elementNames).toContain('period');
    });
    
    it('should return empty array for primitive types', () => {
      const stringType = provider.getType('string')!;
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
      
      // Now it should be available synchronously
      const carePlanType2 = provider.getType('CarePlan');
      expect(carePlanType2).toBeDefined();
      expect(carePlanType2?.name).toBe('CarePlan');
    });
  });

  describe('modelProvider', async () => {
    it('should be able to get type info for FHIR primitive types', async () => {
      const observationType = provider.getType('Observation')!;
      const value = provider.getElementType(observationType, 'value');
      expect(value).toBeDefined();
      const valueType = provider.ofType(value!, 'Quantity');
      expect(valueType?.type).toBe('Quantity');
      const valueType2 = provider.ofType(value!, 'Boolean');
      expect(valueType2?.type).toBe('Boolean');
    });
  });
});