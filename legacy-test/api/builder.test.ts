import { describe, it, expect } from 'bun:test';
import { FHIRPath } from '../../legacy-src';

describe('API - builder', () => {
  it('should create basic API instance', () => {
    const api = FHIRPath.builder().build();
    expect(api.parse).toBeDefined();
    expect(api.evaluate).toBeDefined();
    expect(api.compile).toBeDefined();
    expect(api.analyze).toBeDefined();
    expect(api.registry).toBeDefined();
  });
  
  it('should work with custom functions', () => {
    const api = FHIRPath.builder()
      .withCustomFunction('double', (context, input) => {
        return input.map(x => x * 2);
      })
      .build();
    
    // Registry should know about custom function
    expect(api.registry.hasFunction('double')).toBe(true);
    expect(api.registry.canRegisterFunction('double')).toBe(false); // Already registered
    
    // Should be able to use in evaluation
    const result = api.evaluate('double()', [5]);
    expect(result).toEqual([10]);
  });
  
  it('should work with default variables', () => {
    const api = FHIRPath.builder()
      .withVariable('defaultValue', 42)
      .withVariable('names', ['John', 'Jane'])
      .build();
    
    expect(api.evaluate('%defaultValue')).toEqual([42]);
    expect(api.evaluate('%names')).toEqual(['John', 'Jane']);
  });
  
  it('should chain multiple configurations', () => {
    const api = FHIRPath.builder()
      .withVariable('multiplier', 3)
      .withCustomFunction('triple', (context, input) => {
        return input.map(x => x * 3);
      })
      .withCustomFunction('addOne', (context, input) => {
        return input.map(x => x + 1);
      })
      .build();
    
    expect(api.evaluate('%multiplier')).toEqual([3]);
    expect(api.evaluate('triple()', [5])).toEqual([15]);
    expect(api.evaluate('addOne()', [5])).toEqual([6]);
  });
  
  it('should reject invalid function names', () => {
    expect(() => {
      FHIRPath.builder().withCustomFunction('', () => []);
    }).toThrow(/Function name must be a non-empty string/);
    
    expect(() => {
      FHIRPath.builder().withCustomFunction('123invalid', () => []);
    }).toThrow(/Invalid function name/);
    
    expect(() => {
      FHIRPath.builder().withCustomFunction('my-func', () => []);
    }).toThrow(/Invalid function name/);
  });
  
  it('should prevent overriding built-ins', () => {
    expect(() => {
      FHIRPath.builder().withCustomFunction('where', () => []);
    }).toThrow(/Cannot override built-in operation/);
    
    expect(() => {
      FHIRPath.builder().withCustomFunction('exists', () => []);
    }).toThrow(/Cannot override built-in operation/);
  });
  
  it('should maintain separate registries for different instances', () => {
    const api1 = FHIRPath.builder()
      .withCustomFunction('funcA', () => ['A'])
      .build();
    
    const api2 = FHIRPath.builder()
      .withCustomFunction('funcB', () => ['B'])
      .build();
    
    expect(api1.registry.hasFunction('funcA')).toBe(true);
    expect(api1.registry.hasFunction('funcB')).toBe(false);
    
    expect(api2.registry.hasFunction('funcA')).toBe(false);
    expect(api2.registry.hasFunction('funcB')).toBe(true);
  });
  
  it('should handle model provider in analysis', () => {
    const modelProvider = {
      resolveType: (name: string) => ({ type: name }),
      getTypeHierarchy: (name: string) => [name, 'DomainResource', 'Resource'],
      getProperties: (name: string) => {
        if (name === 'Patient') {
          return [
            { name: 'name', type: 'HumanName', isCollection: true, isRequired: false },
            { name: 'active', type: 'boolean', isCollection: false, isRequired: false }
          ];
        }
        return [];
      }
    };
    
    const api = FHIRPath.builder()
      .withModelProvider(modelProvider)
      .build();
    
    const result = api.analyze('Patient.name');
    expect(result.errors.length).toBe(0);
  });
});