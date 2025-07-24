import { describe, it, expect } from 'bun:test';
import fhirpath from '../../src';

describe('API - debug', () => {
  it('should debug compiled function', () => {
    const compiled = fhirpath.compile('name.given');
    console.log('Compiled function:', compiled);
    console.log('Compiled source:', compiled.source);
    
    const patient = {
      name: [{ given: ['John', 'James'] }]
    };
    
    try {
      const result = compiled(patient);
      console.log('Result:', result);
      expect(result).toEqual(['John', 'James']);
    } catch (error) {
      console.error('Error:', error);
      console.error('Stack:', error.stack);
      throw error;
    }
  });
});