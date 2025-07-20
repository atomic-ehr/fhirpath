import type { Context } from './types';

/**
 * Context management utilities for FHIRPath interpreter.
 * Context flows parallel to data through expressions.
 */
export class ContextManager {
  /**
   * Create a new empty context
   */
  static create(initialInput?: any[]): Context {
    return {
      variables: new Map(),
      env: {},
      $context: initialInput,
      $resource: initialInput,
      $rootResource: initialInput
    };
  }

  /**
   * Create a copy of context (for isolation in sub-expressions)
   */
  static copy(context: Context): Context {
    return {
      variables: new Map(context.variables),
      env: { ...context.env },
      $context: context.$context,
      $resource: context.$resource,
      $rootResource: context.$rootResource
    };
  }

  /**
   * Add or update a variable in context
   */
  static setVariable(context: Context, name: string, value: any[]): Context {
    const newContext = this.copy(context);
    newContext.variables.set(name, value);
    return newContext;
  }

  /**
   * Get a variable value from context
   */
  static getVariable(context: Context, name: string): any[] | undefined {
    // Check user-defined variables first
    if (context.variables.has(name)) {
      return context.variables.get(name);
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
    newContext.env = {
      ...newContext.env,
      $this: [item],
      $index: index
    };
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
    newContext.env = {
      ...newContext.env,
      $total: total
    };
    return newContext;
  }

  /**
   * Clear iterator/aggregate context - restore to original
   */
  static clearEnv(context: Context): Context {
    const newContext = this.copy(context);
    newContext.env = {};
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
   * Check if a variable exists in context
   */
  static hasVariable(context: Context, name: string): boolean {
    return context.variables.has(name) || 
           ['context', 'resource', 'rootResource'].includes(name);
  }

  /**
   * Debug helper - get all variables
   */
  static getAllVariables(context: Context): Record<string, any[]> {
    const result: Record<string, any[]> = {};
    
    // User variables
    context.variables.forEach((value, key) => {
      result[`%${key}`] = value;
    });

    // Root variables
    if (context.$context) result['%context'] = context.$context;
    if (context.$resource) result['%resource'] = context.$resource;
    if (context.$rootResource) result['%rootResource'] = context.$rootResource;

    // Environment variables
    if (context.env.$this !== undefined) result['$this'] = context.env.$this;
    if (context.env.$index !== undefined) result['$index'] = [context.env.$index];
    if (context.env.$total !== undefined) result['$total'] = context.env.$total;

    return result;
  }
}