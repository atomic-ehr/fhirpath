import type { FHIRSchema } from '../src/analyzer/schemas/types';

// Test schemas for analyzer tests
// In production, these would come from the fhirschema library

// Primitives
export const primitives: Record<string, FHIRSchema> = {
  // Basic primitives
  string: {
    name: 'string',
    primitive: true
  },
  
  integer: {
    name: 'integer',
    primitive: true
  },
  
  decimal: {
    name: 'decimal',
    primitive: true
  },
  
  boolean: {
    name: 'boolean',
    primitive: true
  },
  
  // Date/time primitives
  date: {
    name: 'date',
    primitive: true
  },
  
  dateTime: {
    name: 'dateTime',
    primitive: true
  },
  
  time: {
    name: 'time',
    primitive: true
  },
  
  instant: {
    name: 'instant',
    primitive: true
  },
  
  // Other FHIR primitives
  code: {
    name: 'code',
    primitive: true,
    base: 'string'
  },
  
  id: {
    name: 'id',
    primitive: true,
    base: 'string'
  },
  
  uri: {
    name: 'uri',
    primitive: true,
    base: 'string'
  },
  
  url: {
    name: 'url',
    primitive: true,
    base: 'uri'
  },
  
  canonical: {
    name: 'canonical',
    primitive: true,
    base: 'uri'
  },
  
  base64Binary: {
    name: 'base64Binary',
    primitive: true
  },
  
  markdown: {
    name: 'markdown',
    primitive: true,
    base: 'string'
  },
  
  unsignedInt: {
    name: 'unsignedInt',
    primitive: true,
    base: 'integer'
  },
  
  positiveInt: {
    name: 'positiveInt',
    primitive: true,
    base: 'integer'
  },
  
  // Special type
  Any: {
    name: 'Any',
    primitive: true
  }
} as const;

// Base types
export const baseTypes: Record<string, FHIRSchema> = {
  Element: {
    elements: {
      id: { type: 'string' },
      extension: { array: true, type: 'Extension' }
    }
  },
  
  BackboneElement: {
    base: 'Element',
    elements: {
      modifierExtension: { array: true, type: 'Extension' }
    }
  },
  
  Resource: {
    elements: {
      id: { type: 'id' },
      meta: { type: 'Meta' },
      implicitRules: { type: 'uri' },
      language: { type: 'code' }
    }
  },
  
  DomainResource: {
    base: 'Resource',
    elements: {
      text: { type: 'Narrative' },
      contained: { array: true, type: 'Resource' },
      extension: { array: true, type: 'Extension' },
      modifierExtension: { array: true, type: 'Extension' }
    }
  }
} as const;

// Datatypes
export const datatypes: Record<string, FHIRSchema> = {
  // Meta type (needed by Resource)
  Meta: {
    base: 'Element',
    elements: {
      versionId: { type: 'id' },
      lastUpdated: { type: 'instant' },
      source: { type: 'uri' },
      profile: { array: true, type: 'canonical' },
      security: { array: true, type: 'Coding' },
      tag: { array: true, type: 'Coding' }
    }
  },
  
  // Narrative (needed by DomainResource)
  Narrative: {
    base: 'Element',
    elements: {
      status: { type: 'code' },
      div: { type: 'string' }  // Actually xhtml, but treating as string
    }
  },
  
  // Extension
  Extension: {
    base: 'Element',
    elements: {
      url: { type: 'uri' },
      // value[x] - simplified for now
      valueString: { type: 'string', union: 'value' },
      valueBoolean: { type: 'boolean', union: 'value' },
      valueInteger: { type: 'integer', union: 'value' },
      valueDecimal: { type: 'decimal', union: 'value' },
      valueUri: { type: 'uri', union: 'value' },
      valueCode: { type: 'code', union: 'value' },
      valueDateTime: { type: 'dateTime', union: 'value' },
      valueCoding: { type: 'Coding', union: 'value' },
      valueCodeableConcept: { type: 'CodeableConcept', union: 'value' },
      valueReference: { type: 'Reference', union: 'value' }
    }
  },
  
  // Period
  Period: {
    base: 'Element',
    elements: {
      start: { type: 'dateTime' },
      end: { type: 'dateTime' }
    }
  },
  
  // Coding
  Coding: {
    base: 'Element',
    elements: {
      system: { type: 'uri' },
      version: { type: 'string' },
      code: { type: 'code' },
      display: { type: 'string' },
      userSelected: { type: 'boolean' }
    }
  },
  
  // CodeableConcept
  CodeableConcept: {
    base: 'Element',
    elements: {
      coding: { array: true, type: 'Coding' },
      text: { type: 'string' }
    }
  },
  
  // Quantity
  Quantity: {
    base: 'Element',
    elements: {
      value: { type: 'decimal' },
      comparator: { type: 'code' },
      unit: { type: 'string' },
      system: { type: 'uri' },
      code: { type: 'code' }
    }
  },
  
  // HumanName
  HumanName: {
    base: 'Element',
    elements: {
      use: { type: 'code' },
      text: { type: 'string' },
      family: { type: 'string' },
      given: { array: true, type: 'string' },
      prefix: { array: true, type: 'string' },
      suffix: { array: true, type: 'string' },
      period: { type: 'Period' }
    }
  },
  
  // ContactPoint
  ContactPoint: {
    base: 'Element',
    elements: {
      system: { type: 'code' },
      value: { type: 'string' },
      use: { type: 'code' },
      rank: { type: 'positiveInt' },
      period: { type: 'Period' }
    }
  },
  
  // Address
  Address: {
    base: 'Element',
    elements: {
      use: { type: 'code' },
      type: { type: 'code' },
      text: { type: 'string' },
      line: { array: true, type: 'string' },
      city: { type: 'string' },
      district: { type: 'string' },
      state: { type: 'string' },
      postalCode: { type: 'string' },
      country: { type: 'string' },
      period: { type: 'Period' }
    }
  },
  
  // Identifier
  Identifier: {
    base: 'Element',
    elements: {
      use: { type: 'code' },
      type: { type: 'CodeableConcept' },
      system: { type: 'uri' },
      value: { type: 'string' },
      period: { type: 'Period' },
      assigner: { type: 'Reference' }
    }
  },
  
  // Reference
  Reference: {
    base: 'Element',
    elements: {
      reference: { type: 'string' },
      type: { type: 'uri' },
      identifier: { type: 'Identifier' },
      display: { type: 'string' }
    }
  },
  
  // Range
  Range: {
    base: 'Element',
    elements: {
      low: { type: 'Quantity' },
      high: { type: 'Quantity' }
    }
  },
  
  // Ratio
  Ratio: {
    base: 'Element',
    elements: {
      numerator: { type: 'Quantity' },
      denominator: { type: 'Quantity' }
    }
  },
  
  // SampledData
  SampledData: {
    base: 'Element',
    elements: {
      origin: { type: 'Quantity' },
      period: { type: 'decimal' },
      factor: { type: 'decimal' },
      lowerLimit: { type: 'decimal' },
      upperLimit: { type: 'decimal' },
      dimensions: { type: 'positiveInt' },
      data: { type: 'string' }
    }
  },
  
  // Annotation
  Annotation: {
    base: 'Element',
    elements: {
      authorReference: { type: 'Reference', union: 'author' },
      authorString: { type: 'string', union: 'author' },
      time: { type: 'dateTime' },
      text: { type: 'markdown' }
    }
  },
  
  // Timing (simplified)
  Timing: {
    base: 'BackboneElement',
    elements: {
      event: { array: true, type: 'dateTime' },
      repeat: {
        type: 'Element',
        elements: {
          boundsDuration: { type: 'Duration', union: 'bounds' },
          boundsRange: { type: 'Range', union: 'bounds' },
          boundsPeriod: { type: 'Period', union: 'bounds' },
          count: { type: 'positiveInt' },
          countMax: { type: 'positiveInt' },
          duration: { type: 'decimal' },
          durationMax: { type: 'decimal' },
          durationUnit: { type: 'code' },
          frequency: { type: 'positiveInt' },
          frequencyMax: { type: 'positiveInt' },
          period: { type: 'decimal' },
          periodMax: { type: 'decimal' },
          periodUnit: { type: 'code' },
          dayOfWeek: { array: true, type: 'code' },
          timeOfDay: { array: true, type: 'time' },
          when: { array: true, type: 'code' },
          offset: { type: 'unsignedInt' }
        }
      },
      code: { type: 'CodeableConcept' }
    }
  },
  
  // Duration
  Duration: {
    base: 'Quantity'
  }
} as const;

// Resources
export const resources: Record<string, FHIRSchema> = {
  Patient: {
    base: 'DomainResource',
    elements: {
      identifier: { array: true, type: 'Identifier' },
      active: { type: 'boolean' },
      name: { array: true, type: 'HumanName' },
      telecom: { array: true, type: 'ContactPoint' },
      gender: { type: 'code' },
      birthDate: { type: 'date' },
      deceased: { 
        union: true, 
        types: ['boolean', 'dateTime'] 
      },
      deceasedBoolean: { type: 'boolean', union: 'deceased' },
      deceasedDateTime: { type: 'dateTime', union: 'deceased' },
      address: { array: true, type: 'Address' },
      maritalStatus: { type: 'CodeableConcept' },
      contact: {
        type: 'BackboneElement',
        array: true,
        elements: {
          relationship: { array: true, type: 'CodeableConcept' },
          name: { type: 'HumanName' },
          telecom: { array: true, type: 'ContactPoint' },
          address: { type: 'Address' },
          gender: { type: 'code' },
          organization: { type: 'Reference' },
          period: { type: 'Period' }
        }
      },
      communication: {
        type: 'BackboneElement',
        array: true,
        elements: {
          language: { type: 'CodeableConcept' },
          preferred: { type: 'boolean' }
        }
      },
      generalPractitioner: { array: true, type: 'Reference' },
      managingOrganization: { type: 'Reference' }
    }
  },
  
  Observation: {
    base: 'DomainResource',
    elements: {
      identifier: { array: true, type: 'Identifier' },
      basedOn: { array: true, type: 'Reference' },
      partOf: { array: true, type: 'Reference' },
      status: { type: 'code' },
      category: { array: true, type: 'CodeableConcept' },
      code: { type: 'CodeableConcept' },
      subject: { type: 'Reference' },
      focus: { array: true, type: 'Reference' },
      encounter: { type: 'Reference' },
      // effective[x]
      effective: {
        union: true,
        types: ['dateTime', 'Period', 'Timing', 'instant']
      },
      effectiveDateTime: { type: 'dateTime', union: 'effective' },
      effectivePeriod: { type: 'Period', union: 'effective' },
      effectiveInstant: { type: 'instant', union: 'effective' },
      issued: { type: 'instant' },
      performer: { array: true, type: 'Reference' },
      // value[x]
      value: {
        union: true,
        types: ['Quantity', 'CodeableConcept', 'string', 'boolean', 'integer', 'Range', 'Ratio', 'SampledData', 'time', 'dateTime', 'Period']
      },
      valueQuantity: { type: 'Quantity', union: 'value' },
      valueCodeableConcept: { type: 'CodeableConcept', union: 'value' },
      valueString: { type: 'string', union: 'value' },
      valueBoolean: { type: 'boolean', union: 'value' },
      valueInteger: { type: 'integer', union: 'value' },
      valueRange: { type: 'Range', union: 'value' },
      valueRatio: { type: 'Ratio', union: 'value' },
      valueSampledData: { type: 'SampledData', union: 'value' },
      valueTime: { type: 'time', union: 'value' },
      valueDateTime: { type: 'dateTime', union: 'value' },
      valuePeriod: { type: 'Period', union: 'value' },
      dataAbsentReason: { type: 'CodeableConcept' },
      interpretation: { array: true, type: 'CodeableConcept' },
      note: { array: true, type: 'Annotation' },
      bodySite: { type: 'CodeableConcept' },
      method: { type: 'CodeableConcept' },
      specimen: { type: 'Reference' },
      device: { type: 'Reference' },
      referenceRange: {
        type: 'BackboneElement',
        array: true,
        elements: {
          low: { type: 'Quantity' },
          high: { type: 'Quantity' },
          type: { type: 'CodeableConcept' },
          appliesTo: { array: true, type: 'CodeableConcept' },
          age: { type: 'Range' },
          text: { type: 'string' }
        }
      },
      hasMember: { array: true, type: 'Reference' },
      derivedFrom: { array: true, type: 'Reference' },
      component: {
        type: 'BackboneElement',
        array: true,
        elements: {
          code: { type: 'CodeableConcept' },
          // value[x]
          value: {
            union: true,
            types: ['Quantity', 'CodeableConcept', 'string', 'boolean', 'integer', 'Range', 'Ratio', 'SampledData', 'time', 'dateTime', 'Period']
          },
          valueQuantity: { type: 'Quantity', union: 'value' },
          valueCodeableConcept: { type: 'CodeableConcept', union: 'value' },
          valueString: { type: 'string', union: 'value' },
          valueBoolean: { type: 'boolean', union: 'value' },
          valueInteger: { type: 'integer', union: 'value' },
          valueRange: { type: 'Range', union: 'value' },
          valueRatio: { type: 'Ratio', union: 'value' },
          valueSampledData: { type: 'SampledData', union: 'value' },
          valueTime: { type: 'time', union: 'value' },
          valueDateTime: { type: 'dateTime', union: 'value' },
          valuePeriod: { type: 'Period', union: 'value' },
          dataAbsentReason: { type: 'CodeableConcept' },
          interpretation: { array: true, type: 'CodeableConcept' },
          referenceRange: { array: true, type: 'Reference' }  // Reference to Observation.referenceRange
        }
      }
    }
  }
} as const;

// Combine all test schemas
export const testSchemas = {
  ...primitives,
  ...baseTypes,
  ...datatypes,
  ...resources
};