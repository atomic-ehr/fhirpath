import type { Context } from './types';

/**
 * Context management utilities for FHIRPath interpreter.
 * Context flows parallel to data through expressions.
 * 
 * Uses JavaScript prototype chain for efficient inheritance.
 */
export class ContextManager {
  /**
   * Create a new empty context
   */
  static create(initialInput?: any[]): Context {
    // Create base context with null prototype to avoid Object.prototype pollution
    const context = Object.create(null) as Context;
    
    // Initialize with prototype-based objects
    context.variables = Object.create(null);
    context.env = Object.create(null);
    
    // Set root variables
    context.$context = initialInput;
    context.$resource = initialInput;
    context.$rootResource = initialInput;
    
    return context;
  }

  /**
   * Create a child context inheriting from parent via prototype chain
   * O(1) operation - no copying needed
   */
  static copy(context: Context): Context {
    // Create child context with parent as prototype
    const newContext = Object.create(context) as Context;
    
    // Create child objects that inherit from parent's objects
    newContext.variables = Object.create(context.variables);
    newContext.env = Object.create(context.env);
    
    // Root variables are inherited automatically through prototype chain
    // No need to copy them unless they change
    
    return newContext;
  }

  /**
   * Add or update a variable in context
   * Only sets on current context level, shadowing parent values
   */
  static setVariable(context: Context, name: string, value: any[]): Context {
    const newContext = this.copy(context);
    newContext.variables[name] = value;
    return newContext;
  }

  /**
   * Get a variable value from context
   * Uses prototype chain for lookup
   */
  static getVariable(context: Context, name: string): any[] | undefined {
    // Check user-defined variables first (prototype chain handles inheritance)
    if (name in context.variables) {
      return context.variables[name];
    }

    // Check special root variables
    switch (name) {
      case 'context':
        return context.$context;
      case 'resource':
        return context.$resource;
      case 'rootResource':
        return context.$rootResource;
      default:
        return undefined;
    }
  }

  /**
   * Set iterator context ($this, $index) - used by where(), select(), etc.
   */
  static setIteratorContext(
    context: Context, 
    item: any, 
    index: number
  ): Context {
    const newContext = this.copy(context);
    // Only set changed values - prototype provides the rest
    newContext.env.$this = [item];
    newContext.env.$index = index;
    return newContext;
  }

  /**
   * Set aggregate context ($total) - used by aggregate()
   */
  static setAggregateContext(
    context: Context,
    total: any[]
  ): Context {
    const newContext = this.copy(context);
    newContext.env.$total = total;
    return newContext;
  }

  /**
   * Clear iterator/aggregate context - restore to original
   */
  static clearEnv(context: Context): Context {
    const newContext = this.copy(context);
    // Create fresh env object, effectively hiding parent's env values
    newContext.env = Object.create(null);
    return newContext;
  }

  /**
   * Get special environment variable
   */
  static getEnvVariable(context: Context, name: '$this' | '$index' | '$total'): any {
    switch (name) {
      case '$this':
        return context.env.$this;
      case '$index':
        return context.env.$index;
      case '$total':
        return context.env.$total;
      default:
        return undefined;
    }
  }

  /**
   * Check if a variable exists in context (including inherited)
   */
  static hasVariable(context: Context, name: string): boolean {
    return (name in context.variables) || 
           ['context', 'resource', 'rootResource'].includes(name);
  }

  /**
   * Debug helper - get all variables including inherited ones
   * Traverses prototype chain to collect all variables
   */
  static getAllVariables(context: Context): Record<string, any[]> {
    const result: Record<string, any[]> = {};
    
    // Traverse prototype chain for user variables
    let currentVars = context.variables;
    while (currentVars) {
      for (const key in currentVars) {
        if (!(key in result) && Object.prototype.hasOwnProperty.call(currentVars, key)) {
          result[`%${key}`] = currentVars[key]!;
        }
      }
      currentVars = Object.getPrototypeOf(currentVars);
    }

    // Root variables
    if (context.$context) result['%context'] = context.$context;
    if (context.$resource) result['%resource'] = context.$resource;
    if (context.$rootResource) result['%rootResource'] = context.$rootResource;

    // Environment variables (also traverse prototype chain)
    let currentEnv = context.env;
    while (currentEnv) {
      if (currentEnv.$this !== undefined && !('$this' in result)) {
        result['$this'] = currentEnv.$this;
      }
      if (currentEnv.$index !== undefined && !('$index' in result)) {
        result['$index'] = [currentEnv.$index];
      }
      if (currentEnv.$total !== undefined && !('$total' in result)) {
        result['$total'] = currentEnv.$total;
      }
      currentEnv = Object.getPrototypeOf(currentEnv);
    }

    return result;
  }
}