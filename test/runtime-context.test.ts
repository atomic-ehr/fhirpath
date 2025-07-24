import { describe, it, expect } from 'bun:test';
import { RuntimeContextManager } from '../src/runtime/context';
import type { RuntimeContext } from '../src/runtime/context';

describe('RuntimeContext with Prototype Inheritance', () => {
  it('should create a base context', () => {
    const input = [{ name: 'John' }];
    const ctx = RuntimeContextManager.create(input);
    
    expect(ctx.input).toEqual(input);
    expect(ctx.focus).toEqual(input);
    expect(ctx.env.$context).toEqual(input);
    expect(ctx.env.$resource).toEqual(input);
    expect(ctx.env.$rootResource).toEqual(input);
  });

  it('should inherit properties through prototype chain', () => {
    const input = [{ name: 'John' }];
    const parent = RuntimeContextManager.create(input);
    parent.env.customProp = 'parent value';
    
    const child = RuntimeContextManager.copy(parent);
    
    // Child inherits parent's properties
    expect(child.input).toEqual(input);
    expect(child.env.customProp).toBe('parent value');
    expect(child.env.$context).toEqual(input);
  });

  it('should shadow parent properties when modified', () => {
    const parent = RuntimeContextManager.create([1, 2, 3]);
    parent.env.test = 'parent';
    
    const child = RuntimeContextManager.copy(parent);
    child.env.test = 'child';
    
    // Child has its own value
    expect(child.env.test).toBe('child');
    // Parent remains unchanged
    expect(parent.env.test).toBe('parent');
  });

  it('should handle iterator context correctly', () => {
    const input = ['a', 'b', 'c'];
    const base = RuntimeContextManager.create(input);
    
    const iterCtx = RuntimeContextManager.withIterator(base, 'b', 1);
    
    expect(iterCtx.env.$this).toEqual(['b']);
    expect(iterCtx.env.$index).toBe(1);
    expect(iterCtx.input).toEqual(['b']);
    expect(iterCtx.focus).toEqual(['b']);
    
    // Original context unchanged
    expect(base.env.$this).toBeUndefined();
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

  it('should convert between Context and RuntimeContext', () => {
    const context = {
      variables: { x: [1], y: [2] },
      env: { $this: ['item'], $index: 0 },
      $context: ['ctx'],
      $resource: ['res'],
      $rootResource: ['root']
    };
    
    const rtContext = RuntimeContextManager.fromContext(context as any, ['input']);
    
    expect(rtContext.variables?.x).toEqual([1]);
    expect(rtContext.variables?.y).toEqual([2]);
    expect(rtContext.env.$this).toEqual(['item']);
    expect(rtContext.env.$index).toBe(0);
    expect(rtContext.env.$context).toEqual(['ctx']);
    
    // Convert back
    const backToContext = RuntimeContextManager.toContext(rtContext);
    expect(backToContext.variables?.x).toEqual([1]);
    expect(backToContext.env.$this).toEqual(['item']);
    expect((backToContext as any).$context).toEqual(['ctx']);
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
    expect(ctx.variables).toHaveProperty('var999');
    // var0 is in prototype chain, not in own properties
    expect(Object.prototype.hasOwnProperty.call(ctx.variables, 'var999')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(ctx.variables, 'var0')).toBe(false);
  });
});