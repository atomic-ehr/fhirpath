# FHIR Schema

FHIR schema is a anlysis friendly representation of FHIR StructureDefinition.
1. It's nested data structure if compare with list of elements in StructureDefinition
2. It has explicit array and union types
3. Types are simple strings

Let's start with a simple example registry of FHIR Schemas:

FHIR schema is well suited to be a model for FHIRPath analyzer

```yaml
Element:
  elements:
    extension: {array: true, type: Extension}
Meta:
  elements:
    lastUpdated: {type: instant}
    profile: {array: true, type: uri}
    security: {array: true, type: code}
    tag: {array: true, type: Coding}
Resource:
  elements:
    id: {type: id}
    meta: {type: Meta}
    implicitRules: {type: uri}
    language: {type: code}
Extension:
  base: Element
  elements:
    url: {type: uri}
    value: 
      union: true
      types:
        - boolean
        - integer
        - string
    valueString: {type: string, union: 'value'}
    valueBoolean: {type: boolean, union: 'value'}
    valueInteger: {type: integer, union: 'value'}
Narrative:
  base: Element
  elements:
    status: {type: code, valueset: http://hl7.org/fhir/ValueSet/narrative-status}
    div: {type: string}
HumanName:
  base: ComplexType
  elements:
    given: {array: true, type: string}
    family: {type: string}
    use: {type: code, valueset: http://hl7.org/fhir/ValueSet/name-use}
Coding:
  base: Element
  elements:
    system: {type: uri}
    code: {type: code}
    display: {type: string}
CodeableConcept:
  base: ComplexType
  elements:
    coding: {array: true, type: Coding}
    text: {type: string}
Identifier:
  base: Element
  elements:
    use: {type: code, valueset: http://hl7.org/fhir/ValueSet/identifier-use}
    type: {type: CodeableConcept}
    system: {type: uri}
    value: {type: string}
Reference:
  base: Element
  elements:
    reference: {type: string}
    display: {type: string}
    identifier: {array: true, type: Identifier}
DomainResource:
  base: Resource
  elements:
    text: {type: Narrative}
BackboneElement:
  base: Element
  elements:
    modifierExtension: {array: true, type: Extension}
Patient:
  base: DomainResource
  elements:
     name: {array: true, type: HumanName}
     birthDate: {type: date}
     gender: {type: code, valueset: http://hl7.org/fhir/ValueSet/administrative-gender}
     contact:
       type: BackboneElement
       array: true
       elements:
         relationship: {type: code, valueset: http://hl7.org/fhir/ValueSet/contactentity-relationship}
         name: {type: HumanName}
Observation:
  base: DomainResource
  elements:
    status: {type: code, valueset: http://hl7.org/fhir/ValueSet/observation-status}
    code: {type: CodeableConcept}
    subject: {type: Reference}
    effective: {type: dateTime}
    value: {union: true, types: [boolean, integer, string, decimal, dateTime, date, time, Quantity]}
    valueQuantity: {type: Quantity, union: 'value'}
    valueCodeableConcept: {type: CodeableConcept, union: 'value'}
    valueString: {type: string, union: 'value'}
    valueBoolean: {type: boolean, union: 'value'}
    valueInteger: {type: integer, union: 'value'}
    valueDecimal: {type: decimal, union: 'value'}
    valueDateTime: {type: dateTime, union: 'value'}
    valueDate: {type: date, union: 'value'}
    valueTime: {type: time, union: 'value'}
```