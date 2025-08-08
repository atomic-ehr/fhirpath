import { describe, it, expect } from 'bun:test';
import { analyze } from '../src';
import { ErrorCodes } from '../src/errors';

describe('Singleton error messages', () => {
  it('should provide clear error for singleton/collection mismatch', () => {
    // substring expects a singleton string but split returns a collection
    const result = analyze("'hello world'.split(' ').substring(0, 5)");
    
    expect(result.diagnostics).toHaveLength(1);
    const error = result.diagnostics[0];
    
    expect(error?.code).toBe(ErrorCodes.SINGLETON_REQUIRED);
    expect(error?.message).toContain('substring expects a singleton value');
    expect(error?.message).toContain('but received collection type String[]');
  });
  
  it('should use generic error for different type mismatches', () => {
    // substring expects String but gets Integer
    const result = analyze("5.substring(0, 2)");
    
    expect(result.diagnostics).toHaveLength(1);
    const error = result.diagnostics[0];
    
    expect(error?.code).toBe(ErrorCodes.TYPE_NOT_ASSIGNABLE);
    expect(error?.message).toContain('Type Integer is not assignable to type String');
  });
});