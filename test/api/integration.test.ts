import { describe, it, expect } from 'bun:test';
import fhirpath, { FHIRPath } from '../../src';

describe('API - integration', () => {
  it('should work with default export', () => {
    // Parse
    const expr = fhirpath.parse('Patient.name.given');
    expect(expr).toBeDefined();
    
    // Evaluate
    const patient = {
      name: [{ given: ['John', 'James'] }]
    };
    expect(fhirpath.evaluate('name.given', patient)).toEqual(['John', 'James']);
    
    // Compile
    const compiled = fhirpath.compile('name.given');
    expect(compiled(patient)).toEqual(['John', 'James']);
    
    // Registry
    expect(fhirpath.registry.hasFunction('where')).toBe(true);
  });
  
  it('should work with real FHIR data', () => {
    const patient = {
      resourceType: 'Patient',
      id: '123',
      active: true,
      name: [
        {
          use: 'official',
          family: 'Doe',
          given: ['John', 'James']
        },
        {
          use: 'nickname',
          family: 'Doe', 
          given: ['Johnny']
        }
      ],
      birthDate: '1990-01-01',
      gender: 'male'
    };
    
    // Various FHIRPath expressions
    expect(fhirpath.evaluate('name.given', patient)).toEqual(['John', 'James', 'Johnny']);
    expect(fhirpath.evaluate('name.where(use = \'official\').given', patient)).toEqual(['John', 'James']);
    expect(fhirpath.evaluate('name.given.first()', patient)).toEqual(['John']);
    expect(fhirpath.evaluate('name.given.count()', patient)).toEqual([3]);
    expect(fhirpath.evaluate('active and gender = \'male\'', patient)).toEqual([true]);
  });
  
  it('should work with custom setup', () => {
    const api = FHIRPath.builder()
      .withVariable('defaultStatus', 'active')
      .withCustomFunction('isActive', (context, input) => {
        return input.filter(item => item?.active === true);
      })
      .withCustomFunction('fullName', (context, input) => {
        return input.map(name => {
          if (name && typeof name === 'object' && 'given' in name && 'family' in name) {
            const given = Array.isArray(name.given) ? name.given.join(' ') : '';
            return `${given} ${name.family}`.trim();
          }
          return '';
        }).filter(n => n);
      })
      .build();
    
    const patients = [
      { active: true, name: { given: ['John'], family: 'Doe' } },
      { active: false, name: { given: ['Jane'], family: 'Smith' } },
      { active: true, name: { given: ['Bob', 'Robert'], family: 'Johnson' } }
    ];
    
    // Use custom functions
    expect(api.evaluate('isActive()', patients)).toEqual([
      { active: true, name: { given: ['John'], family: 'Doe' } },
      { active: true, name: { given: ['Bob', 'Robert'], family: 'Johnson' } }
    ]);
    
    expect(api.evaluate('isActive().name.fullName()', patients)).toEqual([
      'John Doe',
      'Bob Robert Johnson'
    ]);
    
    // Use default variable
    expect(api.evaluate('%defaultStatus')).toEqual(['active']);
  });
});