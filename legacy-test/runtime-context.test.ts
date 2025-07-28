import { describe, it, expect } from 'bun:test';
import { RuntimeContextManager } from '../legacy-src/runtime/context';
import type { RuntimeContext } from '../legacy-src/runtime/context';

describe('RuntimeContext with Prototype Inheritance', () => {
  it('should create a base context', () => {
    const input = [{ name: 'John' }];
    const ctx = RuntimeContextManager.create(input);
    
    expect(ctx.input).toEqual(input);
    expect(ctx.focus).toEqual(input);
    expect(ctx.variables['%context']).toEqual(input);
    expect(ctx.variables['%resource']).toEqual(input);
    expect(ctx.variables['%rootResource']).toEqual(input);
  });

  it('should inherit properties through prototype chain', () => {
    const input = [{ name: 'John' }];
    const parent = RuntimeContextManager.create(input);
    parent.variables['%customProp'] = 'parent value';
    
    const child = RuntimeContextManager.copy(parent);
    
    // Child inherits parent's properties
    expect(child.input).toEqual(input);
    expect(child.variables['%customProp']).toBe('parent value');
    expect(child.variables['%context']).toEqual(input);
  });

  it('should shadow parent properties when modified', () => {
    const parent = RuntimeContextManager.create([1, 2, 3]);
    parent.variables['%test'] = 'parent';
    
    const child = RuntimeContextManager.copy(parent);
    child.variables['%test'] = 'child';
    
    // Child has its own value
    expect(child.variables['%test']).toBe('child');
    // Parent remains unchanged
    expect(parent.variables['%test']).toBe('parent');
  });

  it('should handle iterator context correctly', () => {
    const input = ['a', 'b', 'c'];
    const base = RuntimeContextManager.create(input);
    
    const iterCtx = RuntimeContextManager.withIterator(base, 'b', 1);
    
    expect(iterCtx.variables['$this']).toEqual(['b']);
    expect(iterCtx.variables['$index']).toBe(1);
    expect(iterCtx.input).toEqual(['b']);
    expect(iterCtx.focus).toEqual(['b']);
    
    // Original context unchanged
    expect(base.variables['$this']).toBeUndefined();
    expect(base.input).toEqual(input);
  });

  it('should handle variables with prototype inheritance', () => {
    const base = RuntimeContextManager.create([]);
    
    const ctx1 = RuntimeContextManager.setVariable(base, 'x', [10]);
    const ctx2 = RuntimeContextManager.setVariable(ctx1, 'y', [20]);
    
    // ctx2 has both variables
    expect(RuntimeContextManager.getVariable(ctx2, 'x')).toEqual([10]);
    expect(RuntimeContextManager.getVariable(ctx2, 'y')).toEqual([20]);
    
    // ctx1 only has x
    expect(RuntimeContextManager.getVariable(ctx1, 'x')).toEqual([10]);
    expect(RuntimeContextManager.getVariable(ctx1, 'y')).toBeUndefined();
    
    // base has neither
    expect(RuntimeContextManager.getVariable(base, 'x')).toBeUndefined();
  });

  it('should handle special variables correctly', () => {
    const input = [{ resourceType: 'Patient' }];
    const ctx = RuntimeContextManager.create(input);
    
    expect(RuntimeContextManager.getVariable(ctx, 'context')).toEqual(input);
    expect(RuntimeContextManager.getVariable(ctx, '%context')).toEqual(input);
    expect(RuntimeContextManager.getVariable(ctx, 'resource')).toEqual(input);
    expect(RuntimeContextManager.getVariable(ctx, 'rootResource')).toEqual(input);
  });


  it('should demonstrate memory efficiency with deep nesting', () => {
    let ctx = RuntimeContextManager.create([0]);
    
    // Create 1000 nested contexts
    for (let i = 0; i < 1000; i++) {
      ctx = RuntimeContextManager.setVariable(ctx, `var${i}`, [i]);
    }
    
    // All variables are accessible
    expect(RuntimeContextManager.getVariable(ctx, 'var0')).toEqual([0]);
    expect(RuntimeContextManager.getVariable(ctx, 'var500')).toEqual([500]);
    expect(RuntimeContextManager.getVariable(ctx, 'var999')).toEqual([999]);
    
    // No deep copying occurred - prototype chain handles inheritance
    expect(ctx.variables).toHaveProperty('%var999');
    // var0 is in prototype chain, not in own properties
    expect(Object.prototype.hasOwnProperty.call(ctx.variables, '%var999')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(ctx.variables, '%var0')).toBe(false);
  });

  describe('Variable Redefinition', () => {
    it('should not allow redefinition of user-defined variables', () => {
      const ctx = RuntimeContextManager.create([]);
      
      // First definition should succeed
      const ctx1 = RuntimeContextManager.setVariable(ctx, 'myVar', [1]);
      expect(RuntimeContextManager.getVariable(ctx1, 'myVar')).toEqual([1]);
      
      // Attempting to redefine should return the same context (no change)
      const ctx2 = RuntimeContextManager.setVariable(ctx1, 'myVar', [2]);
      expect(ctx2).toBe(ctx1); // Same reference - no new context created
      expect(RuntimeContextManager.getVariable(ctx2, 'myVar')).toEqual([1]); // Original value preserved
    });

    it('should allow redefinition when explicitly allowed', () => {
      const ctx = RuntimeContextManager.create([]);
      
      // First definition
      const ctx1 = RuntimeContextManager.setVariable(ctx, 'myVar', [1]);
      expect(RuntimeContextManager.getVariable(ctx1, 'myVar')).toEqual([1]);
      
      // Redefinition with allowRedefinition=true
      const ctx2 = RuntimeContextManager.setVariable(ctx1, 'myVar', [2], true);
      expect(ctx2).not.toBe(ctx1); // New context created
      expect(RuntimeContextManager.getVariable(ctx2, 'myVar')).toEqual([2]); // New value
    });

    it('should not allow redefinition of system variables', () => {
      const ctx = RuntimeContextManager.create([]);
      
      // Attempting to define system variables should return same context
      const ctx1 = RuntimeContextManager.setVariable(ctx, 'context', ['new']);
      expect(ctx1).toBe(ctx); // Same reference - no change
      
      const ctx2 = RuntimeContextManager.setVariable(ctx, 'resource', ['new']);
      expect(ctx2).toBe(ctx); // Same reference - no change
      
      const ctx3 = RuntimeContextManager.setVariable(ctx, 'ucum', ['new']);
      expect(ctx3).toBe(ctx); // Same reference - no change
    });

    it('should allow redefinition of special variables ($this, $index, $total)', () => {
      const ctx = RuntimeContextManager.create([]);
      
      // Set $this
      const ctx1 = RuntimeContextManager.setSpecialVariable(ctx, 'this', ['first']);
      expect(RuntimeContextManager.getVariable(ctx1, '$this')).toEqual(['first']);
      
      // Redefine $this - should succeed
      const ctx2 = RuntimeContextManager.setSpecialVariable(ctx1, 'this', ['second']);
      expect(ctx2).not.toBe(ctx1); // New context created
      expect(RuntimeContextManager.getVariable(ctx2, '$this')).toEqual(['second']);
      
      // Set and redefine $index
      const ctx3 = RuntimeContextManager.setSpecialVariable(ctx, 'index', 1);
      const ctx4 = RuntimeContextManager.setSpecialVariable(ctx3, 'index', 2);
      expect(RuntimeContextManager.getVariable(ctx3, '$index')).toBe(1);
      expect(RuntimeContextManager.getVariable(ctx4, '$index')).toBe(2);
      
      // Set and redefine $total
      const ctx5 = RuntimeContextManager.setSpecialVariable(ctx, 'total', [10]);
      const ctx6 = RuntimeContextManager.setSpecialVariable(ctx5, 'total', [20]);
      expect(RuntimeContextManager.getVariable(ctx5, '$total')).toEqual([10]);
      expect(RuntimeContextManager.getVariable(ctx6, '$total')).toEqual([20]);
    });

    it('should handle variable names with % prefix correctly', () => {
      const ctx = RuntimeContextManager.create([]);
      
      // Define with and without % prefix should be the same variable
      const ctx1 = RuntimeContextManager.setVariable(ctx, 'test', [1]);
      const ctx2 = RuntimeContextManager.setVariable(ctx1, '%test', [2]);
      
      // ctx2 should be same as ctx1 because it's trying to redefine
      expect(ctx2).toBe(ctx1);
      expect(RuntimeContextManager.getVariable(ctx2, 'test')).toEqual([1]);
      expect(RuntimeContextManager.getVariable(ctx2, '%test')).toEqual([1]);
    });
  });
});