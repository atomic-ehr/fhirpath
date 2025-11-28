import { describe, it, expect } from 'bun:test';
import { evaluate } from '../../src/index.node';

describe('Deep Equality with Complex Types', () => {
  it('should perform deep equality on nested objects', async () => {
    const obj1 = { a: 1, b: { c: 2, d: [3, 4] } };
    const obj2 = { a: 1, b: { c: 2, d: [3, 4] } };
    const obj3 = { a: 1, b: { c: 2, d: [3, 5] } };
    
    const result1 = await evaluate('obj1 = obj2', { input: { obj1, obj2 } });
    const result2 = await evaluate('obj1 = obj3', { input: { obj1, obj3 } });
    
    expect(result1).toEqual([true]);  // Same structure and values
    expect(result2).toEqual([false]); // Different nested array value
  });

  it('should handle arrays of objects', async () => {
    const arr1 = [{ x: 1, y: 'a' }, { x: 2, y: 'b' }];
    const arr2 = [{ x: 1, y: 'a' }, { x: 2, y: 'b' }];
    const arr3 = [{ x: 1, y: 'a' }, { x: 2, y: 'c' }];
    
    const result1 = await evaluate('arr1 = arr2', { input: { arr1, arr2 } });
    const result2 = await evaluate('arr1 = arr3', { input: { arr1, arr3 } });
    
    expect(result1).toEqual([true]);  // Same array of objects
    expect(result2).toEqual([false]); // Different value in second object
  });

  it('should handle property order independence', async () => {
    const obj1 = { a: 1, b: 2, c: 3 };
    const obj2 = { c: 3, a: 1, b: 2 }; // Different property order
    
    const result = await evaluate('obj1 = obj2', { input: { obj1, obj2 } });
    expect(result).toEqual([true]); // Should be equal despite different order
  });

  it('should handle FHIR-like resources', async () => {
    const patient1 = {
      resourceType: 'Patient',
      id: '123',
      name: [{ given: ['John'], family: 'Doe' }],
      birthDate: '1980-01-01'
    };
    
    const patient2 = {
      resourceType: 'Patient',
      id: '123',
      name: [{ given: ['John'], family: 'Doe' }],
      birthDate: '1980-01-01'
    };
    
    const patient3 = {
      resourceType: 'Patient',
      id: '123',
      name: [{ given: ['Jane'], family: 'Doe' }],
      birthDate: '1980-01-01'
    };
    
    const result1 = await evaluate('patient1 = patient2', { input: { patient1, patient2 } });
    const result2 = await evaluate('patient1 = patient3', { input: { patient1, patient3 } });
    
    expect(result1).toEqual([true]);  // Same patient data
    expect(result2).toEqual([false]); // Different name
  });

  it('should handle mixed primitive and complex types in collections', async () => {
    const mixed1 = [1, 'hello', { a: 1 }, [2, 3]];
    const mixed2 = [1, 'hello', { a: 1 }, [2, 3]];
    const mixed3 = [1, 'hello', { a: 2 }, [2, 3]];
    
    const result1 = await evaluate('mixed1 = mixed2', { input: { mixed1, mixed2 } });
    const result2 = await evaluate('mixed1 = mixed3', { input: { mixed1, mixed3 } });
    
    expect(result1).toEqual([true]);  // Same mixed collection
    expect(result2).toEqual([false]); // Different object in collection
  });

  it('should handle != operator with deep structures', async () => {
    const obj1 = { a: { b: { c: 1 } } };
    const obj2 = { a: { b: { c: 1 } } };
    const obj3 = { a: { b: { c: 2 } } };
    
    const result1 = await evaluate('obj1 != obj2', { input: { obj1, obj2 } });
    const result2 = await evaluate('obj1 != obj3', { input: { obj1, obj3 } });
    
    expect(result1).toEqual([false]); // Same structure, so not not-equal
    expect(result2).toEqual([true]);  // Different structure, so not-equal
  });
});