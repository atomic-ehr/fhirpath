import { describe, it, expect } from 'bun:test';
import { modelProvider } from './mock-model-provider';

describe('Mock Model Provider', () => {
  describe('getType', () => {
    it('should return type info for known types', () => {
      const patientType = modelProvider.getType('Patient');
      expect(patientType).toBeDefined();
      expect(patientType?.namespace).toBe('FHIR');
      expect(patientType?.name).toBe('Patient');
      expect(patientType?.type).toBe('Any');
      expect(patientType?.singleton).toBe(true);
    });

    it('should return type info for primitive types', () => {
      const stringType = modelProvider.getType('string');
      expect(stringType).toBeDefined();
      expect(stringType?.type).toBe('String');
      expect(stringType?.singleton).toBe(true);
    });

    it('should return undefined for unknown types', () => {
      const unknownType = modelProvider.getType('UnknownType');
      expect(unknownType).toBeUndefined();
    });
  });

  describe('getElementType', () => {
    it('should navigate to simple properties', () => {
      const patientType = modelProvider.getType('Patient')!;
      const nameType = modelProvider.getElementType(patientType, 'name');
      
      expect(nameType).toBeDefined();
      expect(nameType?.type).toBe('Any');
      expect(nameType?.name).toBe('HumanName');
      expect(nameType?.singleton).toBe(false); // name is an array
    });

    it('should navigate nested properties', () => {
      const patientType = modelProvider.getType('Patient')!;
      const nameType = modelProvider.getElementType(patientType, 'name')!;
      const givenType = modelProvider.getElementType(nameType, 'given');
      
      expect(givenType).toBeDefined();
      expect(givenType?.type).toBe('String');
      expect(givenType?.singleton).toBe(false); // given is an array
    });

    it('should handle choice types', () => {
      const patientType = modelProvider.getType('Patient')!;
      const multipleBirthType = modelProvider.getElementType(patientType, 'multipleBirth');
      
      expect(multipleBirthType).toBeDefined();
      expect(multipleBirthType?.type).toBe('Any'); // Choice types are represented as Any
      expect(multipleBirthType?.singleton).toBe(true);
      
      // Verify ofType works with the choice type
      const booleanChoice = modelProvider.ofType(multipleBirthType!, 'Boolean');
      expect(booleanChoice).toBeDefined();
      expect(booleanChoice?.type).toBe('Boolean');
      
      const integerChoice = modelProvider.ofType(multipleBirthType!, 'Integer');
      expect(integerChoice).toBeDefined();
      expect(integerChoice?.type).toBe('Integer');
    });

    it('should return undefined for unknown properties', () => {
      const patientType = modelProvider.getType('Patient')!;
      const unknownType = modelProvider.getElementType(patientType, 'unknownProperty');
      
      expect(unknownType).toBeUndefined();
    });

    it('should handle inherited properties', () => {
      const patientType = modelProvider.getType('Patient')!;
      
      // From Resource
      const idType = modelProvider.getElementType(patientType, 'id');
      expect(idType).toBeDefined();
      expect(idType?.type).toBe('String');
      
      // From DomainResource
      const textType = modelProvider.getElementType(patientType, 'text');
      expect(textType).toBeDefined();
      expect(textType?.type).toBe('Any');
      expect(textType?.name).toBe('Narrative');
    });
  });

  describe('ofType', () => {
    it('should filter union types to specific choice', () => {
      const patientType = modelProvider.getType('Patient')!;
      const multipleBirthType = modelProvider.getElementType(patientType, 'multipleBirth')!;
      
      const booleanChoice = modelProvider.ofType(multipleBirthType, 'Boolean');
      expect(booleanChoice).toBeDefined();
      expect(booleanChoice?.type).toBe('Boolean');
      
      const integerChoice = modelProvider.ofType(multipleBirthType, 'Integer');
      expect(integerChoice).toBeDefined();
      expect(integerChoice?.type).toBe('Integer');
      
      const stringChoice = modelProvider.ofType(multipleBirthType, 'String');
      expect(stringChoice).toBeUndefined();
    });

    it('should return type if it matches for non-union types', () => {
      const patientType = modelProvider.getType('Patient')!;
      const idType = modelProvider.getElementType(patientType, 'id')!;
      
      const stringType = modelProvider.ofType(idType, 'String');
      expect(stringType).toBeDefined();
      expect(stringType?.type).toBe('String');
      
      const booleanType = modelProvider.ofType(idType, 'Boolean');
      expect(booleanType).toBeUndefined();
    });
  });

  describe('getElementNames', () => {
    it('should return all element names including inherited ones', () => {
      const patientType = modelProvider.getType('Patient')!;
      const elementNames = modelProvider.getElementNames(patientType);
      
      // From Patient
      expect(elementNames).toContain('name');
      expect(elementNames).toContain('multipleBirth');
      expect(elementNames).toContain('active');
      expect(elementNames).toContain('birthDate');
      
      // From DomainResource
      expect(elementNames).toContain('text');
      
      // From Resource
      expect(elementNames).toContain('id');
      expect(elementNames).toContain('meta');
      expect(elementNames).toContain('implicitRules');
    });

    it('should return element names for simple types', () => {
      const humanNameType = modelProvider.getType('HumanName')!;
      const elementNames = modelProvider.getElementNames(humanNameType);
      
      expect(elementNames).toContain('given');
      expect(elementNames).toContain('family');
      expect(elementNames.length).toBe(2);
    });
  });
});